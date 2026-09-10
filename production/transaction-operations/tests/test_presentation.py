import copy,sys,tempfile,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from engine import reconcile
from fixture_pack import make_pack,fixture
from documents import generate
from presentation import resolve_identity,brokerage,owner_label
from sources import EvidenceError

PUBLIC='Buy Sell Home Team · RE/MAX Results'
LEGAL='Collopy Real Estate, Inc. d/b/a RE/MAX Results'
OLD='RE/MAX Advantage Plus'

class PresentationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp=tempfile.TemporaryDirectory();cls.folder=make_pack(Path(cls.temp.name)/'sources')
    @classmethod
    def tearDownClass(cls):cls.temp.cleanup()
    def setUp(self):self.c,self.a,_=fixture(self.folder)
    def resolve(self):return reconcile(self.c,self.a,self.folder)
    def seller(self):self.c,self.a,_=fixture(self.folder,'seller')
    def draft(self,r,role='client'):return next(d['body'] for d in r['handoffs'] if d['role']==role)
    def test_context_routes_public_and_legal_separately(self):
        identity=resolve_identity(self.c)
        self.assertEqual(brokerage(identity,'public_footer'),PUBLIC)
        for context in ('contract','compliance','source_evidence','formal_transaction'):
            self.assertEqual(brokerage(identity,context),LEGAL)
        with self.assertRaises(EvidenceError):brokerage(identity,'unspecified')
    def test_old_affiliation_rejected_in_each_identity_field(self):
        for field in ('public_affiliation','legal_brokerage'):
            c=copy.deepcopy(self.c);c['business_identity'][field]['value']=OLD
            with self.assertRaises(EvidenceError):resolve_identity(c)
    def test_public_identity_cannot_replace_legal(self):
        for value in (PUBLIC,'Buy Sell Home Team','RE/MAX Results'):
            c=copy.deepcopy(self.c);c['business_identity']['legal_brokerage']['value']=value
            with self.assertRaises(EvidenceError):resolve_identity(c)
    def test_formal_input_has_no_public_or_stale_fallback(self):
        for value in (PUBLIC,OLD,None):
            c=copy.deepcopy(self.c);c['formal_brokerage']=value
            with self.assertRaises(EvidenceError):resolve_identity(c)
        self.c['formal_brokerage']=LEGAL
        self.assertEqual(self.resolve()['formal_transaction_identity']['blaise_brokerage'],LEGAL)
    def test_identity_requires_current_attributed_input(self):
        for field in ('business_identity',):
            c=copy.deepcopy(self.c);del c[field]
            with self.assertRaises(EvidenceError):resolve_identity(c)
        for key in ('authority','locator','verified_at'):
            c=copy.deepcopy(self.c);del c['business_identity']['legal_brokerage'][key]
            with self.assertRaises(EvidenceError):resolve_identity(c)
    def test_identity_does_not_rewrite_or_certify_originals(self):
        before={p.name:p.read_bytes() for p in self.folder.glob('*.pdf')}
        r=self.resolve()
        self.assertIn('does not establish',r['formal_transaction_identity']['scope'])
        self.assertEqual(before,{p.name:p.read_bytes() for p in self.folder.glob('*.pdf')})
        self.assertEqual(r['business_identity'],self.c['business_identity'])
    def test_print_and_phone_use_public_footer_with_role_labels(self):
        r=self.resolve()
        with tempfile.TemporaryDirectory() as tmp:
            generate(r,Path(tmp))
            for mode in ('Print','Phone'):
                text=(Path(tmp)/('Transaction-Brief-'+mode+'.html')).read_text(encoding='utf-8')
                self.assertIn(PUBLIC,text);self.assertNotIn(OLD,text);self.assertNotIn(LEGAL,text)
                self.assertIn('Contract responsibility:',text);self.assertIn('Follow-through:',text)
                self.assertIn('Avery Sample (seller · other party)',text)
                self.assertNotIn('Operational owner:',text)
    def test_seller_draft_has_only_supported_seller_action(self):
        self.seller();body=self.draft(self.resolve())
        actions,awareness=body.split('Your next steps\n')[1].split('Transaction milestones — for awareness')
        self.assertIn('move-out and key handoff',actions)
        self.assertNotIn('earnest',actions.lower());self.assertNotIn('inspection',actions.lower())
        self.assertIn('Earnest money',awareness);self.assertIn('Inspection / response',awareness)
        self.assertNotIn('what needs attention next',body)
    def test_buyer_draft_keeps_seller_possession_as_awareness(self):
        body=self.draft(self.resolve());actions,awareness=body.split('Your next steps\n')[1].split('Transaction milestones — for awareness')
        self.assertIn('inspection plan',actions);self.assertNotIn('move-out',actions);self.assertNotIn('earnest',actions.lower())
        self.assertIn('Possession',awareness)
    def test_no_client_action_is_not_inferred_from_an_open_deadline(self):
        for o in self.a['obligations']:o.pop('client_actions',None)
        body=self.draft(self.resolve())
        self.assertNotIn('Your next steps',body);self.assertIn('no confirmed action',body)
        self.assertNotIn('specialists are handling',body)
    def test_action_includes_client_even_without_milestone_routing(self):
        self.a['obligations'][1]['handoff_roles']=['tc']
        self.assertIn('inspection plan',self.draft(self.resolve()))
    def test_wrong_party_or_side_action_rejected(self):
        action=self.a['obligations'][1]['client_actions'][0]
        action['party_id']='synthetic-seller'
        with self.assertRaises(EvidenceError):self.resolve()
        action['party_id']=self.c['client']['id'];action['kind']='seller_inspection_access'
        with self.assertRaises(EvidenceError):self.resolve()
    def test_client_action_requires_source_evidence(self):
        self.a['obligations'][1]['client_actions'][0]['evidence']['quote']='made up action evidence'
        with self.assertRaises(EvidenceError):self.resolve()
    def test_supported_seller_access_does_not_inherit_buyer_response_deadline(self):
        self.seller();o=self.a['obligations'][1]
        # Explicit interpretation bound to reviewed evidence; the action has no inferred deadline.
        o['client_actions']=[{'party_id':self.c['client']['id'],'kind':'seller_inspection_access','evidence':o['evidence']}]
        actions=self.draft(self.resolve()).split('Your next steps\n')[1].split('Transaction milestones — for awareness')[0]
        self.assertIn('access arrangements',actions);self.assertNotIn('Sep 21',actions);self.assertNotIn('response before',actions)
    def test_completed_or_unverified_items_have_no_client_action(self):
        self.c,self.a,_=fixture(self.folder,phase='update')
        em=self.a['obligations'][0]
        em['client_actions']=[{'party_id':self.c['client']['id'],'kind':'buyer_deposit','evidence':em['evidence']}]
        self.assertNotIn('earnest-money arrangements',self.draft(self.resolve()))
        self.a['documents'][0]['completion']['signatures']['confirmed']=False
        self.assertNotIn('Your next steps',self.draft(self.resolve()))
    def test_private_fields_cannot_leak_through_client_action(self):
        a=self.a['obligations'][1]['client_actions'][0]
        a['text']=self.c['private_strategy'];a['next_action']='private compensation'
        for d in self.resolve()['handoffs']:
            self.assertNotIn(self.c['private_strategy'],d['body']);self.assertNotIn('private compensation',d['body'])
    def test_specialists_do_not_receive_every_kind_even_if_misrouted(self):
        for o in self.a['obligations']:o['handoff_roles']=['client','tc','lender','title']
        r=self.resolve()
        self.assertNotIn('Inspection',self.draft(r,'lender'));self.assertNotIn('Earnest money',self.draft(r,'lender'))
        self.assertNotIn('Possession',self.draft(r,'lender'));self.assertNotIn('Inspection',self.draft(r,'title'))
        self.assertIn('Closing',self.draft(r,'lender'));self.assertIn('Possession',self.draft(r,'title'))
    def test_party_owners_are_not_internal_operators(self):
        self.seller();r=self.resolve();pos=next(o for o in r['obligations'] if o['id']=='possession')
        self.assertEqual(owner_label(pos,r),'Avery Sample (seller · client)')
        pos['owner']='Morgan Example'
        self.assertEqual(owner_label(pos,r),'Morgan Example (buyer · other party)')
        self.c,self.a,_=fixture(self.folder);r=self.resolve()
        self.assertEqual(owner_label({'owner':'Morgan Example'},r),'Morgan Example (buyer · client)')
        self.assertEqual(owner_label({'owner':'Taylor Coordinator'},r),'Taylor Coordinator (transaction coordinator)')
    def test_party_role_mismatch_rejected(self):
        self.c['party_roles']['synthetic-buyer']='seller'
        with self.assertRaises(EvidenceError):self.resolve()
    def test_technical_owner_fields_preserved_in_private_provenance(self):
        r=self.resolve();out={o['id']:o for o in r['obligations']}
        for o in self.a['obligations']:
            for field in ('responsible_party','owner','owner_status'):
                self.assertEqual(out[o['id']][field],o[field])
    def test_seller_recommendation_is_visibility_not_buyer_administration(self):
        self.seller();r=self.resolve();em=next(o for o in r['obligations'] if o['id']=='em')
        self.assertIn('buyer-side deposit and inspection status',r['recommendation']['text'])
        self.assertIn('buyer’s agent',em['next_action']);self.assertIsNone(em['owner'])
        self.assertNotIn('who will handle deposit',r['recommendation']['reason'])

if __name__=='__main__':unittest.main()
