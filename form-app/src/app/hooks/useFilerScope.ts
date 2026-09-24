import { useLoadAction } from '@uibakery/data';
import loadCurrentFilerAction from '@/actions/loadCurrentFiler';
import { useMondayAutofill } from '@/app/hooks/useMondayAutofill';
import { employeesForFiler } from '@/app/utils/filerScope';

export type FilerStatus = 'loading' | 'filerError' | 'notSignedIn' | 'mondayError' | 'empty' | 'ready';

interface FilerRow { email: string | null; is_admin: boolean | null; admin_name: string | null; }

// Who is filing (the signed-in user) and which employees they may file for.
export function useFilerScope() {
  const monday = useMondayAutofill();
  const [rows, filerLoading, filerError] = useLoadAction(loadCurrentFilerAction, [] as FilerRow[], {});
  const row = (rows as FilerRow[])[0] ?? null;
  const email = (row?.email ?? '').trim().toLowerCase();
  const isAdmin = row?.is_admin === true;

  const scope = employeesForFiler({
    email,
    isAdmin,
    adminName: row?.admin_name ?? null,
    managers: monday.managerEntries,
    allEmployees: monday.allEmployees,
  });

  let status: FilerStatus;
  if (filerLoading || monday.loading) status = 'loading';
  else if (filerError) status = 'filerError';
  else if (!email) status = 'notSignedIn';
  else if (monday.employeesError) status = 'mondayError';
  else if (scope.employees.length === 0) status = 'empty';
  else status = 'ready';

  return {
    status,
    email,
    isAdmin,
    filerName: scope.filerName,
    employees: scope.employees,
    employeePositionMap: monday.employeePositionMap,
    employeeBranchMap: monday.employeeBranchMap,
  };
}
