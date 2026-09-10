"""Local evidence loading. Hash/quote checks aid agent review; they do not verify signatures."""
from pathlib import Path
import hashlib, re
from datetime import datetime
from pypdf import PdfReader
from dateutil.parser import parse as parse_date

class EvidenceError(ValueError): pass
def require(test, message):
    if not test: raise EvidenceError(message)
def normalized(text): return " ".join(str(text).split())
def digest(data): return hashlib.sha256(data).hexdigest()
def timestamp(value):
    t=datetime.fromisoformat(value)
    require(t.tzinfo is not None and t.utcoffset() is not None,"Timestamp needs an explicit offset")
    return t

def source_date(value):
    require(re.search(r"\b\d{4}\b",value),"Source date needs an explicit four-digit year")
    return parse_date(value,fuzzy=False).date()

def source_instant(value,zone):
    from deadlines import local_datetime
    require(re.search(r"\b\d{4}\b",value) and re.search(r"\d{1,2}:\d{2}|\d\s*(?:AM|PM)",value,re.I),"Acceptance needs an explicit date and time")
    dt=parse_date(value,fuzzy=False)
    return dt if dt.tzinfo else local_datetime(dt.date(),dt.time().isoformat(),zone)

class Sources:
    def __init__(self, folder, records, synthetic):
        self.folder=Path(folder).resolve(); self.records={}; self.synthetic=synthetic
        for item in records:
            require(item["id"] not in self.records,"Duplicate source ID")
            s=dict(item); require(s.get("version") and s.get("locator"),"Source version and original locator required")
            if s.get("file"):
                p=(self.folder/s["file"]).resolve()
                require(p.is_relative_to(self.folder) and p.is_file(),"Source file must be inside the input pack")
                raw=p.read_bytes(); pdf=PdfReader(p)
                s["pages"]=[page.extract_text() or "" for page in pdf.pages]
                s["sha256"]=digest(raw); s["page_count"]=len(s["pages"])
                require(all(normalized(p) for p in s["pages"]),"Unreadable page: use supported original-source human verification")
                marked=all("SYNTHETIC" in p for p in s["pages"])
                require(synthetic or not marked,"Synthetic evidence cannot be used as a live agreement")
            else:
                require(s.get("human_verification"),"No readable original or explicit human verification")
                h=s["human_verification"]
                for key in ("verifier_name","verifier_role","verified_at","source_locator","source_version","coverage_statement","covered_sections"):
                    require(h.get(key),"Human verification missing "+key)
                timestamp(h["verified_at"])
                require(h["source_locator"]==s["locator"] and h["source_version"]==s["version"],"Human verification source mismatch")
                require(isinstance(s.get("page_count"),int) and s["page_count"]>0,"Human-verified page count required")
                s["pages"]=None; s["sha256"]=None
            self.records[s["id"]]=s
    def cite(self, ref):
        require(isinstance(ref,dict),"Evidence reference required")
        s=self.records.get(ref.get("source"))
        require(s is not None,"Unknown evidence source")
        require(ref.get("section") and normalized(ref.get("quote","")),"Evidence section and operative quote required")
        page=ref.get("page"); require(isinstance(page,int) and 1<=page<=s["page_count"],"Evidence page outside original")
        if s["pages"] is not None:
            require(normalized(ref["quote"]) in normalized(s["pages"][page-1]),"Quote not present on cited original page")
            label="Source-read"
        else:
            require(ref["section"] in s["human_verification"]["covered_sections"],"Human verification does not cover this section")
            label="Human-verified"
        return dict(ref,version=s["version"],locator=s["locator"],sha256=s["sha256"],label=label)
    def review(self, doc):
        s=self.records.get(doc["source"])
        require(s is not None,"Document source missing")
        review=doc.get("review",{})
        for key in ("reviewer_name","reviewer_role","reviewed_at"):
            require(review.get(key),"Agent review attribution required")
        timestamp(review["reviewed_at"])
        if s["pages"] is not None:
            require(review.get("sha256")==s["sha256"],"Review does not match original bytes")
        s=dict(s)
        s["review_complete"]=review.get("pages")==list(range(1,s["page_count"]+1))
        return s
