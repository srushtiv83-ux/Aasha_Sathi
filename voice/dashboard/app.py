from __future__ import annotations
import json
import sys
from datetime import datetime
from pathlib import Path

import streamlit as st

VOICE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(VOICE / "tools"))
from audio_utils import GnaniSTTClient, make_record, save_session

RESULTS = VOICE / "results"
CATEGORIES = {"kannada":"Kannada", "kanglish":"Kanglish", "hindi":"Hindi", "hinglish":"Hinglish"}
st.set_page_config(page_title="ASHA Sathi STT Lab", page_icon="🎙️", layout="wide")
st.markdown("""<style>
.stApp {background:#f4f8f5} h1,h2,h3 {color:#174b34} div.stButton>button {background:#198754;color:white;border:0;border-radius:8px}
section[data-testid="stSidebar"] {background:#e8f2eb}
</style>""", unsafe_allow_html=True)
st.title("ASHA Sathi · Multilingual STT Lab")
st.caption("Local evaluation tool. Transcripts are experimental and are not verified medical records.")
RESULTS.mkdir(exist_ok=True)

def load_all():
    out=[]
    for path in sorted(RESULTS.glob("session_*.json")):
        try:
            data=json.loads(path.read_text(encoding="utf-8"))
            for row in data.get("records",[]): row["_session_file"]=path.name; out.append(row)
        except (OSError,ValueError): continue
    return out

records=load_all()
st.sidebar.header("Run a transcription test")
st.sidebar.caption("No upload happens until you press a test button. Tests use the existing kn-IN baseline.")
uploaded=st.sidebar.file_uploader("Choose a WAV recording",type=["wav"])
if uploaded and st.sidebar.button("Transcribe this file",use_container_width=True):
    cat=st.sidebar.selectbox("Category for this file",list(CATEGORIES)) if False else "unknown"
    tmp=VOICE/"results"/f"upload_{uploaded.name}"
    tmp.write_bytes(uploaded.getvalue())
    result=GnaniSTTClient().transcribe(tmp)
    row=make_record(tmp,"unknown",result)
    row["audio_filename"]=uploaded.name; row["audio_path"]=""; row["_audio_bytes"]=uploaded.getvalue()
    records.append(row); st.session_state.setdefault("unsaved",[]).append(row)
    tmp.unlink(missing_ok=True)
    st.sidebar.success("Test finished. Review the result below.")

def run_paths(paths):
    new=[]; client=GnaniSTTClient()
    bar=st.progress(0)
    for i,(cat,path) in enumerate(paths,1):
        result=client.transcribe(path)
        try: meta=json.loads(path.with_suffix(".json").read_text(encoding="utf-8"))
        except (OSError,ValueError): meta={}
        new.append(make_record(path,meta.get("category",cat),result,meta.get("sentence",""))); bar.progress(i/len(paths))
    sid=datetime.now().astimezone().strftime("%Y%m%d_%H%M%S_%f")
    jp,cp=save_session(new,sid); st.success(f"Saved results to {jp.name} and {cp.name}"); st.rerun()

col1,col2=st.sidebar.columns(2)
if col1.button("Test all samples",use_container_width=True):
    paths=[(cat,p) for cat in CATEGORIES for p in sorted((VOICE/"test_samples"/cat).glob("*.wav"))]
    if paths: run_paths(paths)
    else: st.sidebar.info("No WAV recordings found in test_samples.")
retry=[(r.get("category","unknown"),Path(r.get("audio_path",""))) for r in records if r.get("error") and r.get("audio_path") and Path(r["audio_path"]).is_file()]
if col2.button("Retry failed",use_container_width=True):
    if retry: run_paths(retry)
    else: st.sidebar.info("No failed tests with available audio files.")

records=load_all()
total=len(records); success=sum(r.get("http_status") is not None and r.get("http_status") < 400 and not r.get("error") for r in records)
failed=total-success; times=[r["response_time_seconds"] for r in records if r.get("response_time_seconds")]
m1,m2,m3,m4=st.columns(4)
m1.metric("Recordings tested",total); m2.metric("Successful requests",success); m3.metric("Failed requests",failed); m4.metric("Average response time",f"{sum(times)/len(times):.2f}s" if times else "—")
st.divider()
if not records:
    st.info("Record audio with `python tools/record_audio.py`, then test samples from the sidebar or run the batch command.")

for cat,title in CATEGORIES.items():
    section=[r for r in records if r.get("category")==cat]
    with st.expander(f"{title} · {len(section)} result(s)",expanded=bool(section)):
        if not section: st.caption("No results yet.")
        for row in section:
            st.markdown(f"**Original test sentence**  \n{row.get('original_sentence') or 'Not recorded'}")
            audio=Path(row.get("audio_path", ""))
            if audio.is_file(): st.audio(audio.read_bytes(),format="audio/wav")
            st.markdown("**Gnani transcript**")
            st.text_area("Transcript",row.get("transcription") or row.get("error") or "No transcript",key=f"t_{row['test_id']}",height=90,label_visibility="collapsed",disabled=True)
            st.caption(f"Config: {row.get('language_code_used','kn-IN')} · HTTP {row.get('http_status') or 'n/a'} · {row.get('response_time_seconds',0):.2f}s · session {row.get('_session_file','')}")
            a,b=st.columns([1,3])
            rating=a.selectbox("Manual rating",["Not rated",1,2,3,4,5],index=0 if row.get("accuracy_score") is None else int(row["accuracy_score"]),key=f"r_{row['test_id']}")
            notes=b.text_input("Notes",value=row.get("notes", ""),key=f"n_{row['test_id']}",placeholder="Missed words, terms lost, number errors, language switching…")
            if a.button("Save rating and notes",key=f"s_{row['test_id']}"):
                row["accuracy_score"]=None if rating=="Not rated" else int(rating); row["notes"]=notes
                sid=Path(row["_session_file"]).stem.removeprefix("session_")
                # Rebuild the whole session so existing entries and assessments stay together.
                path=RESULTS/row["_session_file"]; data=json.loads(path.read_text(encoding="utf-8"));
                for saved in data.get("records",[]):
                    if saved.get("test_id")==row["test_id"]: saved.update(accuracy_score=row["accuracy_score"],notes=notes)
                save_session(data.get("records",[]),sid); st.success("Manual assessment saved."); st.rerun()
        st.markdown("**Transcript comparison**")
        st.dataframe([{"Category":title,"Spoken language":{"kannada":"Kannada","kanglish":"Kannada + English","hindi":"Hindi","hinglish":"Hindi + English"}[cat],"Original":r.get("original_sentence") or "—","Gnani transcript":r.get("transcription") or "—","Rating":r.get("accuracy_score") or "—"} for r in section],use_container_width=True,hide_index=True)

unsaved=st.session_state.get("unsaved",[])
if unsaved:
    st.warning("Uploaded file result is not in a language category yet. Set a category and save it from the controls below.")
    for idx,r in enumerate(unsaved):
        cat=st.selectbox(f"Category · {r['audio_filename']}",list(CATEGORIES),key=f"uc{idx}")
        if st.button("Save uploaded result",key=f"us{idx}"):
            r["category"]=cat; r["audio_path"]=""; save_session([r],datetime.now().astimezone().strftime("%Y%m%d_%H%M%S_%f")); st.session_state["unsaved"].remove(r); st.rerun()

st.caption("Scores are manual reviewer judgments, not automated accuracy measurements. Mixed-language behavior and language detection are not assumed by this tool.")
