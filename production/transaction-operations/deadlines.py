"""Explicit, source-bound date arithmetic. No legal or Minnesota form defaults."""
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from sources import EvidenceError, require, timestamp

def local_datetime(day, clock, zone):
    naive=datetime.combine(day,time.fromisoformat(clock)); tz=ZoneInfo(zone)
    a=naive.replace(tzinfo=tz,fold=0); b=naive.replace(tzinfo=tz,fold=1)
    require(a.utcoffset()==b.utcoffset(),"Ambiguous or nonexistent local time; verify exact instant")
    require(a.astimezone(ZoneInfo("UTC")).astimezone(tz).replace(tzinfo=None)==naive,"Nonexistent local time")
    return a

def calculate(rule, anchors):
    result={"date":None,"at":None,"timezone":rule.get("timezone"),"label":"Unknown","explanation":None,"hold":None}
    try:
        kind=rule.get("type")
        require(kind in ("fixed","relative","unknown"),"Unsupported date rule; obtain professional clarification")
        require(kind!="unknown","Deadline language or anchor is unknown")
        zone=rule.get("timezone");require(zone,"Governing timezone must be resolved")
        ZoneInfo(zone)
        if kind=="fixed":
            day=date.fromisoformat(rule["date"]); explanation="Date stated in controlling evidence"
        else:
            anchor=anchors.get(rule.get("anchor"))
            require(anchor and anchor.get("verified") and anchor.get("at"),"Triggering event is not verified")
            start=timestamp(anchor["at"]).astimezone(ZoneInfo(zone)).date()
            count=rule.get("days")
            require(type(count) is int and count>=0,"An explicit nonnegative day count is required")
            require(type(rule.get("include_anchor")) is bool,"Specify whether the triggering date counts")
            require(rule.get("adjustment")=="none","Date adjustment is unsupported or unresolved")
            unit=rule.get("unit");require(unit in ("calendar","business"),"Calendar/business-day basis unresolved")
            if unit=="calendar":
                day=start+timedelta(days=max(0,count-(1 if rule["include_anchor"] else 0)))
            else:
                weekdays=rule.get("weekdays"); holidays=rule.get("holidays")
                require(isinstance(weekdays,list) and weekdays and all(type(x) is int and 0<=x<=6 for x in weekdays),"Explicit business-day weekdays required")
                require(isinstance(holidays,list),"Explicit applicable holiday calendar required; unknown is not empty")
                holidays={date.fromisoformat(x) for x in holidays}
                day=start; remaining=count
                if rule["include_anchor"] and day.weekday() in weekdays and day not in holidays: remaining=max(0,remaining-1)
                while remaining:
                    day+=timedelta(days=1)
                    if day.weekday() in weekdays and day not in holidays:remaining-=1
            explanation=f'{count} {unit} days from {start.isoformat()}; trigger date '+("included" if rule["include_anchor"] else "excluded")+"; no adjustment"
        result.update(date=day.isoformat(),label="Derived" if kind=="relative" else "Source-stated",explanation=explanation)
        if rule.get("time") is None:
            result["hold"]="Time not established; do not assume midnight or a closing hour"
        else:
            dt=local_datetime(day,rule["time"],zone);result["at"]=dt.isoformat()
    except (EvidenceError,ValueError,KeyError,TypeError,ZoneInfoNotFoundError) as e:
        result["hold"]=str(e)
    return result

def readable_due(due):
    if not due.get("date"): return "To verify"
    day=date.fromisoformat(due["date"]).strftime("%b %d, %Y")
    if not due.get("at"):return day+" · time to verify"
    dt=timestamp(due["at"])
    return day+" · "+dt.strftime("%I:%M %p").lstrip("0")+" "+dt.astimezone(ZoneInfo(due["timezone"])).tzname()
