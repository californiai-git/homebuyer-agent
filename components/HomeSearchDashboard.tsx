"use client";

import { useMemo, useState } from "react";
import AuthButton from "./AuthButton";
import CommonDocuments from "./CommonDocuments";
import HouseDocuments from "./HouseDocuments";
import SavedSearchPanel from "./SavedSearchPanel";
import { ANY_HOME_TYPE, matchListings } from "@/lib/listings";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function HomeSearchDashboard() {
  const [query, setQuery] = useState("");
  const [maxPrice, setMaxPrice] = useState(750000);
  const [homeType, setHomeType] = useState(ANY_HOME_TYPE);
  const [saved, setSaved] = useState<number[]>([]);

  const matches = useMemo(() => matchListings({ query, maxPrice, homeType }), [maxPrice, homeType, query]);

  function toggleSaved(id: number) {
    setSaved((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  return (
    <main>
      <header className="nav">
        <a className="brand" href="#top" aria-label="HomeBuy Agent home"><span>H</span> HomeBuy Agent</a>
        <nav aria-label="Main navigation"><a href="#search">Search</a><a href="#plan">My plan</a><a href="#saved">Saved <b>{saved.length}</b></a><a href="#documents">Documents</a></nav>
        <AuthButton />
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

      <CommonDocuments />

      <section className="search-panel" id="search">
        <label className="location"><span>Where</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="City or address" /></label>
        <label><span>Maximum price</span><select value={maxPrice} onChange={(event) => setMaxPrice(Number(event.target.value))}><option value="400000">$400,000</option><option value="500000">$500,000</option><option value="600000">$600,000</option><option value="700000">$700,000</option><option value="800000">$800,000</option><option value="900000">$900,000</option><option value="1000000">$1,000,000</option><option value="1250000">$1,250,000</option><option value="1500000">$1,500,000+</option></select></label>
        <label><span>Home type</span><select value={homeType} onChange={(event) => setHomeType(event.target.value)}><option>Any home</option><option>House</option><option>Condo</option></select></label>
        <button className="search-button" onClick={() => document.getElementById("results")?.scrollIntoView({ behavior: "smooth" })}>Search homes</button>
      </section>

      <section className="saved-searches-section">
        <SavedSearchPanel
          query={query}
          maxPrice={maxPrice}
          homeType={homeType}
          onApply={(criteria) => {
            setQuery(criteria.query);
            setMaxPrice(criteria.maxPrice);
            setHomeType(criteria.homeType);
          }}
        />
      </section>

      <section className="results" id="results">
        <div className="section-heading"><div><p className="eyebrow">Curated for your plan</p><h2>Homes worth a closer look</h2></div><p>{matches.length} demo {matches.length === 1 ? "home" : "homes"}</p></div>
        <div className="cards" id="saved">
          {matches.map((listing) => (
            <article className="card" key={listing.id}>
              <div className={`house-art ${listing.color}`}><span>{listing.city}</span><button onClick={() => toggleSaved(listing.id)} aria-label={`${saved.includes(listing.id) ? "Remove" : "Save"} ${listing.address}`}>{saved.includes(listing.id) ? "♥" : "♡"}</button><div className="house"><i /><b /><small /></div></div>
              <div className="card-body">
                <div className="price"><strong>{money.format(listing.price)}</strong><span className={listing.fit.toLowerCase().replace(" ", "-")}>{listing.fit}</span></div>
                <h3>{listing.address}</h3><p>{listing.city}, CA · {listing.beds} beds · {listing.baths} baths · {listing.sqft.toLocaleString()} sq ft</p>
                <hr />
                <div className="monthly"><span>Estimated monthly total<small>Mortgage, tax, insurance & fees</small></span><strong>{money.format(listing.monthly)}<small>/mo</small></strong></div>
                <HouseDocuments address={`${listing.address}, ${listing.city}, CA`} />
              </div>
            </article>
          ))}
        </div>
        {matches.length === 0 && <div className="empty"><h3>No demo homes match yet</h3><p>Try a higher maximum price or search Sacramento, Roseville, Elk Grove, or Folsom.</p></div>}
      </section>

      <footer><strong>HomeBuy Agent</strong><p>Demo estimates for research and planning—not a lending commitment or brokerage service.</p><span>Testing preview · Mock listings only</span></footer>
    </main>
  );
}
