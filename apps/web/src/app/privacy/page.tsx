export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold">Privacy Policy</h1>
      <p className="mt-2 text-sm text-white/40">Demo platform</p>
      <div className="mt-8 space-y-4 text-white/70 text-sm leading-relaxed">
        <p>We collect account and gameplay data necessary to operate the demo service.</p>
        <p>Passwords are hashed with Argon2id. No payment card data is stored in demo mode.</p>
      </div>
    </div>
  );
}
