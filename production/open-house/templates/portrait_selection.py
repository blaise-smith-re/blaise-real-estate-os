"""Role-fit portrait selection shared by Open House, Buyer, Seller and marketing templates."""
def recommend(candidates, roles, recent_ids=()):
    used=set(); selected={}
    for role in roles:
        eligible=[c for c in candidates if c.get('approved') and c.get('fit',{}).get(role,0)>0 and c['id'] not in used]
        if not eligible: raise ValueError(f'No unused approved portrait fits {role}; review the library rather than silently repeating.')
        choice=max(eligible,key=lambda c:(c['fit'][role]-(15 if c['id'] in recent_ids else 0),c['id']))
        selected[role]=choice['file'];used.add(choice['id'])
    return selected

