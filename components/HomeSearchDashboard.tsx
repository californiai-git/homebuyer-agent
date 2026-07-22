"use client";

import { useMemo, useState } from "react";
import AuthButton from "./AuthButton";
import SideNav from "./SideNav";
import ThemeToggle from "./ThemeToggle";
import { ANY_HOME_TYPE } from "@/lib/listings";
import { useListings } from "@/lib/useListings";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function HomeSearchDashboard() {
  const [query, setQuery] = useState("");
  const [maxPrice, setMaxPrice] = useState(700000);
  const [homeType, setHomeType] = useState(ANY_HOME_TYPE);
  const [saved, setSaved] = useState<number[]>([]);

  const criteria = useMemo(() => ({ query, maxPrice, homeType }), [query, maxPrice, homeType]);
  const { listings, provider, loading, error } = useListings(criteria);

  function toggleSaved(id: number) {
    setSaved((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function applySearch(next: { query: string; maxPrice: number; homeType: string }) {
    setQuery(next.query);
    setMaxPrice(next.maxPrice);
    setHomeType(next.homeType);
  }

  return (
    <main>
      <header className="nav">
        <a className="brand" href="#top" aria-label="HomeBuy Agent home"><span>H</span> HomeBuy Agent</a>
        <nav aria-label="Main navigation"><a href="#search">Search</a><a href="#plan">My plan</a><a href="#saved">Saved <b>{saved.length}</b></a></nav>
        <div className="nav-actions">
          <ThemeToggle />
          <AuthButton />
        </div>
      </header>

      <section className="hero" id="top">
        <div>
          <p className="eyebrow">Buy with clarity</p>
          <h1>Find a home that fits<br />your life <em>and</em> your budget.</h1>
          <p className="intro">Explore homes with a complete monthly-cost estimate, personalized to your financial comfort zone.</p>
        </div>
        <aside id="plan">
          <p>Your comfortable monthly payment</p>
          <strong>$4,200</strong><span>/ month</span>
          <div className="meter"><i /></div>
          <small>Based on a demo buyer plan · <a href="#search">Adjust plan</a></small>
        </aside>
      </section>

      <div className="app-shell">
        <SideNav query={query} maxPrice={maxPrice} homeType={homeType} onApply={applySearch} />

        <div className="app-main">
          <section className="search-panel" id="search">
            <label className="location"><span>Where</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="City or address" /></label>
            <label><span>Maximum price</span><select value={maxPrice} onChange={(event) => setMaxPrice(Number(event.target.value))}><option value="400000">$400,000</option><option value="500000">$500,000</option><option value="600000">$600,000</option><option value="700000">$700,000</option><option value="800000">$800,000</option><option value="900000">$900,000</option><option value="1000000">$1,000,000</option><option value="1250000">$1,250,000</option><option value="1500000">$1,500,000+</option></select></label>
            <label><span>Home type</span><select value={homeType} onChange={(event) => setHomeType(event.target.value)}><option>Any home</option><option>House</option><option>Condo</option></select></label>
            <button className="search-button" onClick={() => document.getElementById("results")?.scrollIntoView({ behavior: "smooth" })}>Search homes</button>
          </section>

          <section className="results" id="results">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Curated for your plan</p>
                <h2>Homes worth a closer look</h2>
              </div>
              <p>
                {loading ? "Loading…" : `${listings.length} ${listings.length === 1 ? "home" : "homes"}`}
                {provider ? ` · ${provider}` : ""}
              </p>
            </div>

            {error && <div className="doc-error">{error}</div>}

            <div className="cards" id="saved">
              {listings.map((listing) => (
                <article className="card" key={listing.id}>
                  <div className={`house-art ${listing.color}`} style={listing.photo ? { backgroundImage: `url(${listing.photo})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
                    <span>{listing.city || listing.type}</span>
                    <button onClick={() => toggleSaved(listing.id)} aria-label={`${saved.includes(listing.id) ? "Remove" : "Save"} ${listing.address}`}>{saved.includes(listing.id) ? "♥" : "♡"}</button>
                    {!listing.photo && <div className="house"><i /><b /><small /></div>}
                  </div>
                  <div className="card-body">
                    <div className="price"><strong>{money.format(listing.price)}</strong><span className={listing.fit.toLowerCase().replace(" ", "-")}>{listing.fit}</span></div>
                    <h3>{listing.address}</h3>
                    <p>{listing.city ? `${listing.city} · ` : ""}{listing.beds} beds · {listing.baths} baths{listing.sqft ? ` · ${listing.sqft.toLocaleString()} sq ft` : ""}</p>
                    <hr />
                    <div className="monthly"><span>Estimated monthly total<small>Mortgage, tax, insurance & fees</small></span><strong>{money.format(listing.monthly)}<small>/mo</small></strong></div>
                  </div>
                </article>
              ))}
            </div>

            {!loading && listings.length === 0 && !error && (
              <div className="empty">
                <h3>No homes match yet</h3>
                <p>Try a higher maximum price, a different home type, or a different city or address.</p>
              </div>
            )}
          </section>
        </div>
      </div>

      <footer><strong>HomeBuy Agent</strong><p>Demo estimates for research and planning—not a lending commitment or brokerage service.</p><span>{provider || "Testing preview"}</span></footer>
    </main>
  );
}

