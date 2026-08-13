import { Activity, CheckCircle2, Minus, Plus } from 'lucide-react';
import { useState } from 'react';

import { getHealth } from '@/services/health';
import { useCounterStore } from '@/stores/counter';

type HealthTone = 'idle' | 'success' | 'error';

/** 展示路由、共享状态和请求层的最小可运行组合。 */
export default function HomePage() {
  const count = useCounterStore((state) => state.count);
  const increment = useCounterStore((state) => state.increment);
  const [healthStatus, setHealthStatus] = useState('Not checked');
  const [healthTone, setHealthTone] = useState<HealthTone>('idle');
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);

  /** 执行健康检查并转换为用户可读状态，同时阻止重复网络请求。 */
  async function checkHealth() {
    if (isCheckingHealth) {
      return;
    }

    setIsCheckingHealth(true);
    setHealthStatus('Checking');
    setHealthTone('idle');

    try {
      await getHealth();
      setHealthStatus('Available');
      setHealthTone('success');
    } catch {
      setHealthStatus('Unavailable');
      setHealthTone('error');
    } finally {
      setIsCheckingHealth(false);
    }
  }

  return (
    <>
      <section className="page-heading">
        <p className="eyebrow">Workspace overview</p>
        <h1>Business application baseline</h1>
        <p>Routing, state, API access, tests, and code quality are ready for product work.</p>
      </section>

      <section className="dashboard-grid" aria-label="Application examples">
        <article className="panel">
          <div className="panel-heading">
            <span className="icon-box">
              <Plus size={18} />
            </span>
            <div>
              <h2>Shared state</h2>
              <p>Zustand action example</p>
            </div>
          </div>
          <div className="metric">{count}</div>
          <div className="button-row">
            <button className="icon-button" type="button" title="Decrease" disabled>
              <Minus size={18} />
            </button>
            <button className="primary-button" type="button" onClick={increment}>
              <Plus size={18} /> Increment
            </button>
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <span className="icon-box accent">
              <Activity size={18} />
            </span>
            <div>
              <h2>API health</h2>
              <p>Axios service example</p>
            </div>
          </div>
          <div className="status-line" data-tone={healthTone}>
            <CheckCircle2 size={18} />
            <span>{healthStatus}</span>
          </div>
          <button
            className="secondary-button"
            type="button"
            disabled={isCheckingHealth}
            onClick={checkHealth}
          >
            {isCheckingHealth ? 'Checking...' : 'Check endpoint'}
          </button>
        </article>
      </section>
    </>
  );
}
