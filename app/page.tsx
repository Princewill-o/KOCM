import Link from 'next/link';
import { ArrowRight, BookOpen, Users, MapPin } from 'lucide-react';
import './landing.css';
export default function Home() {
  return <main className="koc-landing">
    <header className="landing-header"><Link href="/" className="landing-brand"><img src="/kharis-logo.png" alt="" /><span>Kharis On Campus</span></Link><Link href="/login" className="landing-login">Member login <ArrowRight size={16} /></Link></header>
    <section className="landing-hero"><div className="landing-eyebrow">FAITH · FELLOWSHIP · UNIVERSITY LIFE</div><h1>A place to belong.<br /><span>A faith to grow.</span></h1><p>Connect with Kharis On Campus at your university. Grow together in prayer, fellowship and sharing the gospel.</p><a href="#get-connected" className="landing-primary">Find your next step <ArrowRight size={18} /></a></section>
    <section id="get-connected" className="landing-choices" aria-label="Get connected">
      <article><span className="landing-card-icon"><MapPin size={24} /></span><h2>Want to start a KOC at your university?</h2><p>Register your interest with the KOC team. Campus accounts are reviewed before access is approved.</p><Link href="/signup">Register your interest <ArrowRight size={18} /></Link><small>Choose your university during registration. If it is not listed, speak with your cluster lead.</small></article>
      <article><span className="landing-card-icon"><Users size={24} /></span><h2>Already a member of KOC?</h2><p>Sign in to your campus account for weekly reporting, fellowship records and materials from your leaders.</p><Link href="/login">Sign in to the platform <ArrowRight size={18} /></Link><small>New campus representative? <Link href="/signup">Request an account</Link>.</small></article>
    </section>
    <section className="landing-purpose"><BookOpen size={24} /><div><h2>One community. Many campuses.</h2><p>A shared space to support your campus fellowship and stay connected with the wider KOC family.</p></div></section>
    <footer>Kharis On Campus Management <span>Growing together, wherever you study.</span></footer>
  </main>;
}
