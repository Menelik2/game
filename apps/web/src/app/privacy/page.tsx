export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold">Privacy · ግላዊነት</h1>
      <p className="mt-2 text-sm text-white/40">Digital Equb demo</p>
      <div className="mt-8 space-y-4 text-sm leading-relaxed text-white/70">
        <p>
          In demo mode, your display name and activity may be stored on your device (browser storage)
          so you can continue a session.
        </p>
        <p>
          We do not process payment cards or Telebirr payments in this demo. No real financial
          account numbers should be entered here.
        </p>
        <p>
          If the service later connects to a server or real payments, this policy will be updated to
          explain what data is stored and why.
        </p>
      </div>
    </div>
  );
}
