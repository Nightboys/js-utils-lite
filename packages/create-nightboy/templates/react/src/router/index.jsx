import { Route, Switch } from 'wouter';

import AppLayout from '@/components/AppLayout.jsx';
import HomePage from '@/pages/HomePage.jsx';
import NotFoundPage from '@/pages/NotFoundPage.jsx';

/** 集中声明应用布局和页面边界，未知路径统一进入可恢复的 404 页面。 */
export default function AppRouter() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={HomePage} />
        <Route>
          <NotFoundPage />
        </Route>
      </Switch>
    </AppLayout>
  );
}
