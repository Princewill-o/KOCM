import Link from "next/link";
import { ArrowRight } from "lucide-react";
import "./landing.css";

export default function Home() {
  return (
    <main className="koc-landing">
      <header className="landing-header">
        <Link href="/" className="landing-brand">
          <img src="/kharis-logo.png" alt="" />
          <span>Kharis On Campus</span>
        </Link>
        <Link href="/login" className="landing-login">
          Member login <ArrowRight size={16} />
        </Link>
      </header>
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-intro">
          <p className="landing-eyebrow">OUR CAMPUS COMMUNITY</p>
          <h1 id="landing-title">
            Faith and fellowship,
            <br />
            through university life.
          </h1>
          <p className="landing-description">
            Kharis On Campus brings students together for prayer, fellowship and
            sharing the gospel at universities across the UK.
          </p>
        </div>
        <div className="landing-aside">
          <span className="landing-aside-label">KOC MANAGEMENT</span>
          <p>
            A shared workspace
            <br />
            for your campus fellowship.
          </p>
          <span>
            Weekly reports, fellowship records
            <br />
            and resources from your leaders.
          </span>
        </div>
      </section>
      <section
        id="get-connected"
        className="landing-choices"
        aria-labelledby="landing-connect-title"
      >
        <div className="landing-section-heading">
          <p className="landing-eyebrow">GET CONNECTED</p>
          <h2 id="landing-connect-title">Your next step</h2>
        </div>
        <article className="landing-entry">
          <span className="landing-entry-number" aria-hidden="true">
            01
          </span>
          <div>
            <h3>Want to start a KOC at your university?</h3>
            <p>
              Request a campus account to connect with the KOC team. An
              administrator will review your university before access is
              approved.
            </p>
            <small>University not listed? Speak with your cluster lead.</small>
          </div>
          <Link href="/signup">
            Request campus access <ArrowRight size={18} />
          </Link>
        </article>
        <article className="landing-entry">
          <span className="landing-entry-number" aria-hidden="true">
            02
          </span>
          <div>
            <h3>Already a member of KOC?</h3>
            <p>
              Sign in to submit your weekly report, keep fellowship records and
              read resources shared with your campus.
            </p>
            <small>
              New campus representative?{" "}
              <Link href="/signup">Request an account</Link>.
            </small>
          </div>
          <Link href="/login">
            Sign in to your workspace <ArrowRight size={18} />
          </Link>
        </article>
      </section>
      <section
        className="landing-purpose"
        aria-labelledby="landing-purpose-title"
      >
        <h2 id="landing-purpose-title">
          One community,
          <br />
          across the UK.
        </h2>
        <p>
          Stay connected with your campus fellowship and the wider KOC family,
          with support from your cluster and ministry leads.
        </p>
      </section>
      <footer>
        <span>Kharis On Campus</span>
        <span>Prayer · Outreach · Fellowship</span>
      </footer>
    </main>
  );
}
