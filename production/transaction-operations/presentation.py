"""Contextual identity and audience labels; never reinterpret executed terms."""
from pathlib import Path
import copy,json
from sources import require,timestamp

def resolve_identity(case):
    expected=json.loads((Path(__file__).with_name('governance.json')).read_text(encoding='utf-8'))['identity_guard']
    identity=copy.deepcopy(case.get('business_identity',{}))
    for field in ('public_affiliation','legal_brokerage'):
        record=identity.get(field,{})
        require(record.get('value')==expected[field], 'Resolve current '+field+' from governing identity; no stale or cross-context substitute')
        require(all(record.get(k) for k in ('authority','locator','verified_at')), 'Identity needs attributed authority, locator and verification time')
        timestamp(record['verified_at'])
    # A formal field is never populated from a public footer or team-name fallback.
    if 'formal_brokerage' in case:
        require(case['formal_brokerage']==identity['legal_brokerage']['value'], 'Formal brokerage must use the legal entity')
    return identity

def brokerage(identity,context):
    fields={'public_footer':'public_affiliation','contract':'legal_brokerage','compliance':'legal_brokerage','source_evidence':'legal_brokerage','formal_transaction':'legal_brokerage'}
    require(context in fields,'Explicit brokerage context required')
    return identity[fields[context]]['value']

def party_bindings(case):
    ids=case['party_ids'];names=case['party_names'];roles=case.get('party_roles',{})
    require(len(ids)==len(names) and len(set(ids))==len(ids),'Exact party name/ID bindings required')
    require(set(roles)==set(ids) and all(r in ('buyer','seller') for r in roles.values()),'Buyer/seller role required for every party')
    require(case['client']['id'] in roles and roles[case['client']['id']]==case['side'],'Client role must match represented side')
    parties=[{'id':i,'name':n,'role':roles[i]} for i,n in zip(ids,names)]
    require(next(p['name'] for p in parties if p['id']==case['client']['id'])==case['client']['name'],'Client name must match party binding')
    return parties

def owner_label(obligation,result):
    name=obligation.get('owner')
    if not name:return 'To confirm'
    matches=[p for p in result['parties'] if p['name']==name]
    if matches:
        require(len(matches)==1,'Ambiguous party owner; resolve exact identity')
        p=matches[0]
        return name+' ('+p['role']+' · '+('client' if p['id']==result['client_id'] else 'other party')+')'
    if name=='Blaise Smith':return name+' (agent)'
    people=[p for p in result['people'] if p.get('name')==name and p['role']!='client']
    roles={'tc':'transaction coordinator','lender':'lender','title':'title / closing'}
    return name+' ('+(roles[people[0]['role']] if len(people)==1 else 'role to verify')+')'

# The interpreter explicitly identifies a supported action for the exact client.
# Safe copy excludes private next_action, strategy and source quotations.
CLIENT_ACTIONS={
    'buyer_inspection':('buyer','inspection','Confirm your inspection plan with me and review the response before the deadline.'),
    'buyer_deposit':('buyer','earnest_money','Confirm your earnest-money arrangements with the verified deposit holder.'),
    'buyer_financing':('buyer','financing','Confirm with your lender what they need from you for this financing milestone.'),
    'buyer_closing':('buyer','closing','Confirm your signing arrangements with the closing team.'),
    'seller_closing':('seller','closing','Confirm your signing arrangements with the closing team.'),
    'buyer_possession':('buyer','possession','Confirm the agreed possession arrangements with me.'),
    'seller_possession':('seller','possession','Confirm your move-out and key handoff arrangements with me.'),
    'seller_inspection_access':('seller','inspection','Confirm the requested inspection access arrangements with me.'),
    'buyer_title':('buyer','title','Review the title item with the closing team and confirm the response needed from you.'),
    'seller_title':('seller','title','Review the title item with the closing team and confirm the response needed from you.')}

def client_actions(obligation,case,src):
    actions=[]
    for action in obligation.get('client_actions',[]):
        key=action.get('kind');require(key in CLIENT_ACTIONS,'Unsupported client action; resolve recipient-safe wording')
        side,kind,text=CLIENT_ACTIONS[key]
        require(action.get('party_id')==case['client']['id'] and side==case['side'] and kind==obligation['kind'],'Client action must match exact client, side and obligation')
        proof=src.cite(action['evidence'])
        actions.append({'kind':key,'party_id':action['party_id'],'text':text,'evidence':proof})
    return actions

MILESTONES={'earnest_money':'Earnest money','inspection':'Inspection / response','closing':'Closing','possession':'Possession','financing':'Financing milestone','title':'Title milestone','other':'Contract milestone'}
SPECIALIST_KINDS={'tc':set(MILESTONES),'lender':{'financing','closing'},'title':{'title','closing','possession','earnest_money'}}
