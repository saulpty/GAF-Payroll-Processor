// Is the signed-in person a disciplinary admin (Tim or Saul, the
// disciplinary_admins table)? Never true while viewAs points at someone else.
// Gates Edit, Delete, Restore and the Deleted filter. This is only the UI side:
// the database checks the same list again on every edit, delete and restore.
import { useLoadAction } from '@uibakery/data';
import loadDisciplinaryAdminAction from '@/actions/loadDisciplinaryAdmin';
import { useViewer } from '@/app/context/ViewerContext';

type AdminRow = { is_admin: boolean | string | null };

export function useDisciplinaryAdmin(): { isDisciplinaryAdmin: boolean; loading: boolean } {
  const { isViewingAs } = useViewer();
  const [rows, loading] = useLoadAction(loadDisciplinaryAdminAction, [] as AdminRow[]);
  const flag = (rows as AdminRow[])[0]?.is_admin;
  const isAdmin = flag === true || flag === 'true' || flag === 't';
  return { isDisciplinaryAdmin: isAdmin && !isViewingAs, loading };
}
