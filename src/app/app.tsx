'use client';

import '@/index.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import TopNav from '@/app/TopNav';
import FilterBar from '@/app/FilterBar';
import { GlobalFilterProvider } from '@/app/context/GlobalFilterContext';
import ProcessPayroll from '@/app/pages/ProcessPayroll';
import ActionRequired from '@/app/pages/ActionRequired';
import PayrollMaster from '@/app/pages/PayrollMaster';
import SummaryDashboard from '@/app/pages/SummaryDashboard';
import AdminLayout from '@/app/pages/admin/AdminLayout';
import AdminSchedules from '@/app/pages/admin/AdminSchedules';
import AdminHolidays from '@/app/pages/admin/AdminHolidays';
import AdminDstCalendar from '@/app/pages/admin/AdminDstCalendar';
import AdminLookups from '@/app/pages/admin/AdminLookups';
import AdminEmployeesHub from '@/app/pages/admin/AdminEmployeesHub';
import PeriodLog from '@/app/pages/PeriodLog';
import Attendance from '@/app/pages/Attendance';
import HrkSummary from '@/app/pages/HrkSummary';

function App() {
  return (
    <BrowserRouter>
      <GlobalFilterProvider>
        <div className="flex flex-col h-screen overflow-hidden bg-background">
          <TopNav />
          <FilterBar />
          <main className="flex-1 overflow-auto">
            <Routes>
              <Route path="/" element={<Navigate to="/summary" replace />} />
              <Route path="/process" element={<ProcessPayroll />} />
              <Route path="/action-required" element={<ActionRequired />} />
              <Route path="/payroll-master" element={<PayrollMaster />} />
              <Route path="/summary" element={<SummaryDashboard />} />
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<Navigate to="/admin/employees" replace />} />
                <Route path="employees" element={<AdminEmployeesHub />} />
                <Route path="aliases" element={<Navigate to="/admin/employees?tab=aliases" replace />} />
                <Route path="directory-sync" element={<Navigate to="/admin/employees?tab=monday" replace />} />
                <Route path="schedules" element={<AdminSchedules />} />
                <Route path="holidays" element={<AdminHolidays />} />
                <Route path="dst-calendar" element={<AdminDstCalendar />} />
                <Route path="lookups" element={<AdminLookups />} />
              </Route>
              <Route path="/period-log" element={<PeriodLog />} />
              {/* Single instance — tab driven by URL, no remount on tab switch */}
              <Route path="/attendance/*" element={<Attendance />} />
              <Route path="/hrk-summary" element={<HrkSummary />} />
            </Routes>
          </main>
        </div>
      </GlobalFilterProvider>
    </BrowserRouter>
  );
}

export default App;
