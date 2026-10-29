type PasswordProvider = {
  changePassword(input: {currentPassword: string; newPassword: string; revokeOtherSessions: boolean}): Promise<{error?: {message?: string} | null}>;
};
export async function changeAccountPassword(client: PasswordProvider | null, current: string, password: string, confirmation: string) {
  if (!client) throw new Error('Use verified-email password recovery for this authentication provider.');
  if (!current) throw new Error('Enter your current password.');
  if (password.length < 8 || password.length > 200) throw new Error('Use a password between 8 and 200 characters.');
  if (password !== confirmation) throw new Error('New passwords must match.');
  const result = await client.changePassword({currentPassword: current, newPassword: password, revokeOtherSessions: true});
  if (result.error) throw new Error(result.error.message || 'Password change failed');
}
