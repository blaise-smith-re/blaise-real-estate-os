"""Editorial guard: internal QA must not silently enter consumer marketing."""
import re,html
def validate_public(body,policy):
    # Only explicitly sourced required text may be exempted, never the entire asset.
    required=policy.get('approved_required_disclaimer')
    if required:
        if not policy.get('disclaimer_source'): raise ValueError('Public disclosure exception requires current authority')
        body=body.replace(html.escape(required),'')
    text=html.unescape(re.sub('<[^>]+>',' ',body)).lower()
    flags=['per the listing','subject to verification','needs verification','need verification','do not freestyle','source conflict','confidence label','risk control','disclosure analysis','source:','most recent list price','authorization hold']
    found=[x for x in flags if x in text]
    found += re.findall(r'\b(?:cancelled|canceled|confidence level|verification pending|disclosure-analysis|authorization hold|do not publish)\b',text)
    if found: raise ValueError('Backstage language in public copy; review exact-asset requirement: '+', '.join(found))
