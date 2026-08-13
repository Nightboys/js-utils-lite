import { ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';

/** 为未知路由提供清晰说明和返回入口。 */
export default function NotFoundPage() {
  return (
    <section className="empty-state">
      <p className="eyebrow">404</p>
      <h1>Page not found</h1>
      <p>The requested route does not exist.</p>
      <Link className="primary-button" href="/">
        <ArrowLeft size={18} /> Back home
      </Link>
    </section>
  );
}
