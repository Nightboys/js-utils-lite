import { LayoutDashboard } from 'lucide-react';
import { Link, useRoute } from 'wouter';

/** 提供应用稳定导航和页面出口，具体业务操作由路由页面承载。 */
export default function AppLayout({ children }) {
  const [isOverviewActive] = useRoute('/');

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Nightboy workspace home">
          <span className="brand-mark">
            <LayoutDashboard size={18} />
          </span>
          <span>Nightboy Workspace</span>
        </Link>
        <nav aria-label="Primary navigation">
          <Link className={isOverviewActive ? 'active' : undefined} href="/">
            Overview
          </Link>
        </nav>
      </header>

      <main className="page-container">{children}</main>
    </div>
  );
}
