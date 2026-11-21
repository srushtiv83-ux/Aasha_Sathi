import { useState } from 'react';
import Icon from './Icon.jsx';

const STORAGE_KEY = 'asha_sathi_local_referral_contact';

function loadContact() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return { name: typeof value.name === 'string' ? value.name : '', phone: typeof value.phone === 'string' ? value.phone : '' };
  } catch {
    return { name: '', phone: '' };
  }
}

export default function EmergencyGuidance() {
  const [contact, setContact] = useState(loadContact);
  const [saved, setSaved] = useState(contact);
  const [message, setMessage] = useState('');
  const inputClass = 'mt-1 min-h-11 w-full rounded-md border border-light-error/40 bg-white px-3 font-body text-body-md text-light-on-surface placeholder:text-light-on-surface-variant focus-visible:outline focus-visible:outline-2 focus-visible:outline-light-error';
  const phoneUri = saved.phone.trim().replace(/[^\d+]/g, '');

  const saveContact = () => {
    const normalized = { name: contact.name.trim(), phone: contact.phone.trim() };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      setSaved(normalized);
      setContact(normalized);
      setMessage('Local referral contact saved on this device.');
    } catch {
      setMessage('Could not save the local referral contact on this device.');
    }
  };

  return (
    <section className="mt-gutter-md rounded-md border border-light-error/30 bg-light-error-container p-gutter-md text-light-on-error-container" aria-label="High-priority referral contacts">
      <h4 className="font-title text-title-md font-bold">High-priority referral contacts</h4>
      <p className="mt-1 font-body text-body-sm">Use a verified local facility contact. The app does not infer a nearby hospital or its phone number.</p>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="font-label text-label-sm">Nearby hospital / PHC<input className={inputClass} value={contact.name} onChange={(event) => setContact((current) => ({ ...current, name: event.target.value }))} placeholder="Facility name" /></label>
        <label className="font-label text-label-sm">Facility phone<input className={inputClass} type="tel" inputMode="tel" value={contact.phone} onChange={(event) => setContact((current) => ({ ...current, phone: event.target.value }))} placeholder="Verified phone number" /></label>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button type="button" onClick={saveContact} className="min-h-10 rounded-full bg-light-error px-4 font-label text-label-sm text-white hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-light-error">Save contact</button>
        <p className="font-body text-body-sm font-semibold">Nearby hospital / PHC: {saved.name || 'Not configured'}</p>
        <p className="font-body text-body-sm font-semibold">Facility phone: {saved.phone || 'Not configured'}</p>
        {phoneUri && <a href={`tel:${phoneUri}`} className="inline-flex min-h-10 items-center gap-1 rounded-full border border-light-error px-3 font-label text-label-sm underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-light-error"><Icon name="call" />{saved.phone}</a>}
      </div>
      {message && <p role="status" className="mt-2 font-body text-body-sm">{message}</p>}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-light-error/25 pt-2 font-body text-body-sm">
        <a href="tel:108" className="min-h-10 inline-flex items-center gap-1 font-semibold underline"><Icon name="call" />Emergency ambulance: 108</a>
        <a href="tel:102" className="min-h-10 inline-flex items-center gap-1 font-semibold underline"><Icon name="call" />Pregnant women / child transport: 102</a>
        <a href="tel:112" className="min-h-10 inline-flex items-center gap-1 font-semibold underline"><Icon name="call" />Emergency response: 112</a>
      </div>
      <p className="mt-1 font-body text-body-sm">Confirm the appropriate service for your area and situation.</p>
    </section>
  );
}
