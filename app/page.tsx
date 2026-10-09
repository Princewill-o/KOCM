import BrandLogo from '@/components/ui/brand-logo';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { ThemeToggle } from './theme';
import './landing.css';
import {LiquidButton} from '@/components/ui/liquid-glass-button';
import TextHighlight from '@/components/ui/text-highlight';
import SteppedMorphSlider from '@/components/ui/stepped-morph-slider';
import {LandingReveal} from '@/components/ui/landing-reveal';
import AgentDock from '@/components/ui/agent-dock';

export default function Home() {
  return <main className="koc-landing">
    <header className="landing-header">
      <Link href="/" className="landing-brand"><BrandLogo /></Link>
      <div className="landing-header-actions"><ThemeToggle /><LiquidButton asChild size="sm"><Link href="/login">Member login <ArrowRight size={16} /></Link></LiquidButton></div>
    </header>

    <section className="landing-hero" aria-labelledby="landing-title">
      <LandingReveal className="landing-intro">
        <p className="landing-eyebrow">FAITH · FRIENDSHIP · FELLOWSHIP</p>
        <h1 id="landing-title">Life at KOC.<br /><TextHighlight delay={.15}>Shared in faith.</TextHighlight></h1>
        <p className="landing-description">A community to pray with, grow with and share life with. This is Kharis On Campus.</p>
        <LiquidButton asChild variant="gold" className="landing-hero-cta"><a href="#get-connected">Get connected <ArrowRight size={18} /></a></LiquidButton>
        <p className="landing-hero-note">For KOC members, representatives and ministry leads.</p>
      </LandingReveal>
      <SteppedMorphSlider slides={[{image:"/community/koc-community.jpg",title:"Our KOC community",caption:"Faith, friendship and life together."},{image:"/community/praying-together.jpg",title:"Taking time to pray",caption:"Growing in faith, side by side."}]} />
    </section>

    <section className="landing-community" aria-labelledby="landing-community-title">
      <LandingReveal className="landing-prayer-photo"><figure><img src="/community/praying-together.jpg" alt="Kharis On Campus members gathered in a circle to pray together." width="1600" height="1200" loading="lazy" /><figcaption>Taking time to pray together.</figcaption></figure></LandingReveal>
      <div className="landing-community-copy"><p className="landing-eyebrow">LIFE TOGETHER</p><h2 id="landing-community-title">A fellowship that<br /><TextHighlight>feels like community.</TextHighlight></h2><p>We come together to pray, study the Word and share the gospel. Along the way, we build friendships and support one another in faith.</p><div className="landing-community-values"><span>Prayer</span><span>Outreach</span><span>Fellowship</span></div></div>
    </section>

    <section className="landing-fellowship" aria-labelledby="landing-fellowship-title">
      <div className="landing-fellowship-copy"><p className="landing-eyebrow">JOIN OUR FELLOWSHIP</p><h2 id="landing-fellowship-title">There is room<br /><TextHighlight>for you here.</TextHighlight></h2><p>Connect with your KOC fellowship to find out when and where to meet, and how to get involved.</p><p className="landing-meeting-note">Fellowship every Tuesday. Confirm the time and venue with your KOC team.</p><Link href="/signup" className="landing-text-link">Connect with the KOC team <ArrowRight size={17} /></Link></div>
      <figure className="landing-flyer"><img src="/community/fellowship-lettering.png" alt="Kharis On Campus — Fellowship with us every Tuesday!" width="1672" height="941" loading="lazy" /></figure>
    </section>

    <section id="get-connected" className="landing-choices" aria-labelledby="landing-connect-title">
      <div className="landing-section-heading"><p className="landing-eyebrow">GET CONNECTED</p><h2 id="landing-connect-title"><TextHighlight>Your next step</TextHighlight></h2></div>
      <article className="landing-entry"><span className="landing-entry-number" aria-hidden="true">01</span><div><h3>Want to start a KOC?</h3><p>Apply to connect with the Kharis On Campus team. An administrator will review your request and help with the next steps.</p><small>Need help getting started? Speak with your cluster lead.</small></div><LiquidButton asChild variant="gold"><Link href="/signup">Apply here <ArrowRight size={18} /></Link></LiquidButton></article>
      <article className="landing-entry"><span className="landing-entry-number" aria-hidden="true">02</span><div><h3>Already a member of KOC?</h3><p>Sign in to submit your weekly report, keep fellowship records and read resources shared with your KOC team.</p><small>New KOC representative? <Link href="/signup">Apply here</Link>.</small></div><LiquidButton asChild><Link href="/login">Sign in to your workspace <ArrowRight size={18} /></Link></LiquidButton></article>
    </section>
    <AgentDock />
    <footer><span>Kharis On Campus</span><span>Prayer · Outreach · Fellowship</span></footer>
  </main>;
}
