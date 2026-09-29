export default function PromotionsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-3xl font-bold">Promotions</h1>
      <p className="mt-1 text-white/50">Demo bonuses — virtual credits only</p>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {['Welcome Pack', 'Daily Free Spins', 'Weekend Reload', 'Loyalty Rewards'].map((t) => (
          <div key={t} className="glass rounded-2xl p-6 border border-white/10">
            <span className="text-[10px] font-bold uppercase text-amber-400">DEMO</span>
            <h2 className="mt-2 text-xl font-semibold">{t}</h2>
          </div>
        ))}
      </div>
    </div>
  );
}
