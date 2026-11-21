"""Beginner-friendly desktop WAV recorder. Recording never uploads automatically."""
from __future__ import annotations
import queue
import sys
import threading
import time
import wave
import json
from datetime import datetime
from pathlib import Path
import tkinter as tk
from tkinter import messagebox, ttk
import numpy as np

try:
    import sounddevice as sd
except ImportError:
    sd = None

VOICE = Path(__file__).resolve().parents[1]
RATE, CHANNELS = 16000, 1
PHRASES = {
 "Kannada": "ಗರ್ಭಿಣಿಗೆ ಏಳು ತಿಂಗಳ ಗರ್ಭಾವಸ್ಥೆಯಾಗಿದೆ. ನಿನ್ನೆಯಿಂದ ತಲೆನೋವು ಇದೆ, ಕಾಲುಗಳಲ್ಲಿ ಊತವಿದೆ. ರಕ್ತದೊತ್ತಡವನ್ನು ಪರೀಕ್ಷಿಸಿ.",
 "Kanglish": "Patient-ge seven months pregnancy ide. Yesterday inda headache ide, legs swelling aagide. BP check maadi.",
 "Hindi": "महिला को गर्भावस्था के सात महीने हो गए हैं। कल से सिरदर्द है और पैरों में सूजन है। रक्तचाप जाँच लीजिए।",
 "Hinglish": "Patient seven months pregnant hai. Kal se headache ho raha hai aur legs mein swelling hai. BP check karna hai."
}
CAT = {"Kannada":"kannada", "Kanglish":"kanglish", "Hindi":"hindi", "Hinglish":"hinglish"}

class Recorder:
 def __init__(self, root):
    self.root=root; self.root.title("ASHA Sathi · Audio Recorder"); self.root.geometry("620x520"); self.root.configure(bg="#f3f8f4")
    self.frames=[]; self.stream=None; self.started=None; self.running=False; self.path=None
    style=ttk.Style(); style.configure("TButton",padding=8); style.configure("TLabel",background="#f3f8f4",font=("Segoe UI",10))
    ttk.Label(root,text="Record a test sample",font=("Segoe UI",20,"bold")).pack(anchor="w",padx=24,pady=(20,10))
    ttk.Label(root,text="Audio stays on this computer until you choose to run a test.",foreground="#4a6554").pack(anchor="w",padx=24)
    box=ttk.Frame(root); box.pack(fill="x",padx=24,pady=18)
    ttk.Label(box,text="Language category").pack(anchor="w")
    self.category=tk.StringVar(value="Kannada"); self.combo=ttk.Combobox(box,textvariable=self.category,values=list(PHRASES),state="readonly"); self.combo.pack(fill="x",pady=(4,12)); self.combo.bind("<<ComboboxSelected>>",self.change_phrase)
    ttk.Label(box,text="Test sentence (editable)").pack(anchor="w")
    self.text=tk.Text(box,height=4,wrap="word",font=("Segoe UI",11)); self.text.pack(fill="x",pady=4); self.change_phrase()
    self.timer=ttk.Label(root,text="00:00",font=("Segoe UI",24,"bold")); self.timer.pack(pady=8)
    row=ttk.Frame(root); row.pack(pady=8)
    ttk.Button(row,text="●  Start recording",command=self.start).pack(side="left",padx=5)
    ttk.Button(row,text="■  Stop",command=self.stop).pack(side="left",padx=5)
    ttk.Button(row,text="▶  Play",command=self.play).pack(side="left",padx=5)
    ttk.Button(row,text="↻  Re-record",command=self.rerecord).pack(side="left",padx=5)
    ttk.Button(root,text="Save recording",command=self.save).pack(pady=5)
    self.status=ttk.Label(root,text="Ready · WAV · 16 kHz · mono PCM16"); self.status.pack(pady=8)
 def change_phrase(self,*_):
    self.text.delete("1.0","end"); self.text.insert("1.0",PHRASES.get(self.category.get(),""))
 def start(self):
    if sd is None: messagebox.showerror("Audio unavailable","Install the dependencies from requirements.txt, then reopen this recorder."); return
    if self.running: return
    try:
      self.frames=[]; self.started=time.monotonic(); self.running=True
      def callback(indata,frames,time_info,status):
        if status: self.root.after(0,lambda: self.status.configure(text=f"Microphone: {status}"))
        self.frames.append(bytes(indata))
      self.stream=sd.RawInputStream(samplerate=RATE,channels=CHANNELS,dtype="int16",callback=callback); self.stream.start()
      self.status.configure(text="Recording…"); self.tick()
    except Exception as e:
      self.running=False; messagebox.showerror("Microphone unavailable",f"Could not start microphone. Check Windows microphone permission and device.\n\n{e}")
 def tick(self):
    if self.running:
      elapsed=int(time.monotonic()-self.started); self.timer.configure(text=f"{elapsed//60:02}:{elapsed%60:02}"); self.root.after(250,self.tick)
 def stop(self):
    if not self.running: return
    self.running=False
    try: self.stream.stop(); self.stream.close()
    except Exception: pass
    self.status.configure(text="Recording stopped · Play or save it, or re-record.")
 def rerecord(self):
    if self.running: self.stop()
    self.frames=[]; self.path=None; self.timer.configure(text="00:00"); self.status.configure(text="Ready for a new recording.")
 def save(self):
    if self.running: self.stop()
    if not self.frames: messagebox.showinfo("No audio","Record audio before saving."); return
    cat=CAT[self.category.get()]; outdir=VOICE/"test_samples"/cat; outdir.mkdir(parents=True,exist_ok=True)
    target=outdir/f"{cat}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.wav"
    try:
      with wave.open(str(target),"wb") as w: w.setnchannels(CHANNELS); w.setsampwidth(2); w.setframerate(RATE); w.writeframes(b"".join(self.frames))
      target.with_suffix(".json").write_text(json.dumps({"category":cat,"sentence":self.text.get("1.0","end").strip()},ensure_ascii=False,indent=2),encoding="utf-8")
      self.path=target; self.status.configure(text=f"Saved: {target.relative_to(VOICE)} · test upload must be started separately")
    except OSError as e: messagebox.showerror("Save failed",str(e))
 def play(self):
    if self.running: self.stop()
    if not self.frames: messagebox.showinfo("No audio","Record audio before playback."); return
    if sd is None: return
    try: sd.play(np.frombuffer(b"".join(self.frames),dtype=np.int16),samplerate=RATE); self.status.configure(text="Playing recording…")
    except Exception as e: messagebox.showerror("Playback failed",str(e))

if __name__=="__main__":
 root=tk.Tk(); Recorder(root); root.mainloop()
