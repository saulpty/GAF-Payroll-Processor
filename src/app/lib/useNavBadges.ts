import { useEffect, useRef } from 'react';
import { useLoadAction } from '@uibakery/data';
import loadContractsExpiringCountAction from '@/actions/loadContractsExpiringCount';
import loadDisciplinaryDueCountAction from '@/actions/loadDisciplinaryDueCount';
import loadPtoReviewCountAction from '@/actions/loadPtoReviewCount';
import { toLocalYMD } from '@/app/lib/classificationEngine';
import { useGlobalFilters } from '@/app/context/GlobalFilterContext';
import { useViewer } from '@/app/context/ViewerContext';

export type NavBadges = { contracts: number; disciplinary: number; pto: number };

/** The three orange nav counts. Call it ONCE, in Shell (app.tsx), and pass the result to the bars. */
export function useNavBadges(): NavBadges {
  const { ptoVersion } = useGlobalFilters();
  const { viewAs } = useViewer();

  const [expiringData]    = useLoadAction(loadContractsExpiringCountAction, [] as { count: number }[], { viewAs });
  const expiringCount     = (expiringData as { count: number }[])[0]?.count ?? 0;
  const asOf              = toLocalYMD(new Date());
  const [dueData]         = useLoadAction(loadDisciplinaryDueCountAction, [] as { count: number }[], { asOf });
  const dueCount          = (dueData as { count: number }[])[0]?.count ?? 0;
  const [reviewData, , , reloadReview] = useLoadAction(loadPtoReviewCountAction, [] as { count: number }[], { today: asOf, manager: null, viewAs });
  const reviewCount       = (reviewData as { count: number }[])[0]?.count ?? 0;

  // Reload PTO review count whenever a PTO record is written anywhere in the app
  const ptoVersionRef = useRef(ptoVersion);
  useEffect(() => {
    if (ptoVersionRef.current !== ptoVersion) {
      ptoVersionRef.current = ptoVersion;
      reloadReview();
    }
  }, [ptoVersion, reloadReview]);

  return { contracts: expiringCount, disciplinary: dueCount, pto: reviewCount };
}
