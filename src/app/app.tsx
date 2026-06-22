'use client';

import '@/index.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import TopNav from '@/app/TopNav';
import ProcessPayroll from '@/app/pages/ProcessPayroll';
import ActionRequired from '@/app/pages/ActionRequired';
import PayrollMaster from '@/app/pages/PayrollMaster';
import SummaryDashboard from '@/app/pages/SummaryDashboard';
import AdminLayout from '@/app/pages/admin/AdminLayout';
import AdminEmployees from '@/app/pages/admin/AdminEmployees';
import AdminAliases from '@/app/pages/admin/AdminAliases';
import AdminSchedules from '@/app/pages/admin/AdminSchedules';
import AdminHolidays from '@/app/pages/admin/AdminHolidays';
import AdminDstCalendar from '@/app/pages/admin/AdminDstCalendar';
import AdminLookups from '@/app/pages/admin/AdminLookups';
import AdminEmployeeSync from '@/app/pages/admin/AdminEmployeeSync';
import AdminGraceList from '@/app/pages/admin/AdminGraceList';
import AdminMacbookSwap from '@/app/pages/admin/AdminMacbookSwap';
import PeriodLog from '@/app/pages/PeriodLog';
import Attendance from '@/app/pages/Attendance';
import HrkSummary from '@/app/pages/HrkSummary';

// datasource reconnected — migrations will apply on load
function App() {
  return (
    <BrowserRouter>
      <div className="flex flex-col h-screen overflow-hidden bg-background">
        <TopNav />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Navigate to="/summary" replace />} />
            <Route path="/process" element={<ProcessPayroll />} />
            <Route path="/action-required" element={<ActionRequired />} />
            <Route path="/payroll-master" element={<PayrollMaster />} />
            <Route path="/summary" element={<SummaryDashboard />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="/admin/employees" replace />} />
              <Route path="employees" element={<AdminEmployees />} />
              <Route path="aliases" element={<AdminAliases />} />
              <Route path="schedules" element={<AdminSchedules />} />
              <Route path="holidays" element={<AdminHolidays />} />
              <Route path="dst-calendar" element={<AdminDstCalendar />} />
              <Route path="lookups" element={<AdminLookups />} />
              <Route path="directory-sync" element={<AdminEmployeeSync />} />
              <Route path="grace-list" element={<AdminGraceList />} />
              <Route path="macbook-swap" element={<AdminMacbookSwap />} />
            </Route>
            <Route path="/period-log" element={<PeriodLog />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/hrk-summary" element={<HrkSummary />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
