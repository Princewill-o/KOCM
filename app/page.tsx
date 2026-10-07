import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { ThemeToggle } from './theme';
import './landing.css';

export default function Home() {
  return <main className="koc-landing">
    <header className="landing-header">
      <Link href="/" className="landing-brand"><img src="/kharis-logo.png" alt="" /><span>Kharis On Campus</span></Link>
      <div className="landing-header-actions"><ThemeToggle /><Link href="/login" className="landing-login">Member login <ArrowRight size={16} /></Link></div>
    </header>

    <section className="landing-hero" aria-labelledby="landing-title">
      <div className="landing-intro">
        <p className="landing-eyebrow">FAITH · FRIENDSHIP · FELLOWSHIP</p>
        <h1 id="landing-title">University life.<br />Shared in faith.</h1>
        <p className="landing-description">A community to pray with, grow with and walk through university life with. This is Kharis On Campus.</p>
        <a href="#get-connected" className="landing-primary">Get connected <ArrowRight size={18} /></a>
        <p className="landing-hero-note">For students, campus representatives and ministry leads.</p>
      </div>
      <figure className="landing-hero-photo">
        <img src="/community/koc-community.jpg" alt="Kharis On Campus members together outdoors, many wearing yellow Kharis hoodies." width="1600" height="1200" fetchPriority="high" />
        <figcaption><span>Our campus community</span><span>Kharis On Campus</span></figcaption>
      </figure>
    </section>

    <section className="landing-community" aria-labelledby="landing-community-title">
      <figure className="landing-prayer-photo"><img src="/community/praying-together.jpg" alt="Kharis On Campus members gathered in a circle to pray together." width="1600" height="1200" loading="lazy" /><figcaption>Taking time to pray together.</figcaption></figure>
      <div className="landing-community-copy"><p className="landing-eyebrow">LIFE TOGETHER</p><h2 id="landing-community-title">A fellowship that<br />feels like community.</h2><p>We gather around prayer, the Word and sharing the gospel. Along the way, we build friendships and support one another through university life.</p><div className="landing-community-values"><span>Prayer</span><span>Outreach</span><span>Fellowship</span></div></div>
    </section>

    <section className="landing-fellowship" aria-labelledby="landing-fellowship-title">
      <div className="landing-fellowship-copy"><p className="landing-eyebrow">COME AND FELLOWSHIP</p><h2 id="landing-fellowship-title">There is room<br />for you here.</h2><p>Connect with your campus fellowship to find out when and where to meet, and how to get involved.</p><p className="landing-meeting-note">Our flyer invites students to Tuesday fellowship. Confirm the time and venue with your campus team.</p><Link href="/signup" className="landing-text-link">Connect with the KOC team <ArrowRight size={17} /></Link></div>
      <figure className="landing-flyer"><img src="/community/fellowship-tuesday.jpg" alt="Kharis On Campus flyer: Fellowship with us every Tuesday. The venue is not specified." width="900" height="1600" loading="lazy" /></figure>
    </section>

    <section id="get-connected" className="landing-choices" aria-labelledby="landing-connect-title">
      <div className="landing-section-heading"><p className="landing-eyebrow">GET CONNECTED</p><h2 id="landing-connect-title">Your next step</h2></div>
      <article className="landing-entry"><span className="landing-entry-number" aria-hidden="true">01</span><div><h3>Want to start a KOC at your university?</h3><p>Request a campus account to connect with the KOC team. An administrator will review your university before access is approved.</p><small>University not listed? Speak with your cluster lead.</small></div><Link href="/signup">Request campus access <ArrowRight size={18} /></Link></article>
      <article className="landing-entry"><span className="landing-entry-number" aria-hidden="true">02</span><div><h3>Already a member of KOC?</h3><p>Sign in to submit your weekly report, keep fellowship records and read resources shared with your campus.</p><small>New campus representative? <Link href="/signup">Request an account</Link>.</small></div><Link href="/login">Sign in to your workspace <ArrowRight size={18} /></Link></article>
    </section>
    <footer><span>Kharis On Campus</span><span>Prayer · Outreach · Fellowship</span></footer>
  </main>;
}
