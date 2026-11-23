import { redirect } from 'next/navigation';

export default function TransactionsPage() {
  redirect('/admin/profits?tab=ledger');
}
