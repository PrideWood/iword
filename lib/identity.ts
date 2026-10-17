import { currentAccount } from './session';
export async function workspaceIdentity() {
  const account = await currentAccount();
  return account?.role === 'teacher' ? account.workspaceId : null;
}
