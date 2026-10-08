// @vitest-environment jsdom
import { createElement } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({signin:vi.fn(),signup:vi.fn(),username:vi.fn(),email:vi.fn(),attach:vi.fn(),session:vi.fn()}));
vi.mock('../lib/koc', () => ({listCampuses:() => Promise.resolve([{id:'campus',name:'Campus'}]),friendly:(error:Error) => error.message,requestPasswordReset:vi.fn(),setNewPassword:vi.fn(),updateOwnProfile:vi.fn(),changeOwnEmail:mocks.email,changePassword:vi.fn(),adminSetEmail:vi.fn(),ROLE_LABELS:{campus:'Campus rep'}}));
vi.mock('../lib/supabase', () => ({supabase:() => ({auth:{getSession:mocks.session}})}));
vi.mock('../lib/username-auth', async original => ({...await original<object>(),signInWithIdentifier:mocks.signin,signUpWithUsername:mocks.signup,updateMyUsername:mocks.username,attachNotificationEmail:mocks.attach}));
vi.mock('../app/theme', () => ({ThemeToggle:() => null}));
import AuthPage from '../app/auth-page';
import ProfileView from '../app/views/profile';
afterEach(cleanup);
beforeEach(() => {vi.clearAllMocks();mocks.session.mockResolvedValue({data:{session:null}});mocks.signup.mockResolvedValue(undefined);mocks.username.mockResolvedValue(undefined);mocks.email.mockResolvedValue(undefined);mocks.attach.mockResolvedValue(undefined);});
describe('username account forms', () => {
  it('requests a username account without any email field and explains pending access', async () => {
    render(createElement(AuthPage,{mode:'signup'}));
    await screen.findByText('Campus');
    expect(screen.queryByLabelText('Email address')).toBeNull();
    fireEvent.change(screen.getByLabelText('Your name'),{target:{value:'Campus Lead'}});
    fireEvent.change(screen.getByLabelText('University'),{target:{value:'campus'}});
    fireEvent.change(screen.getByLabelText(/^Username/),{target:{value:'campus_lead'}});
    fireEvent.change(screen.getByLabelText(/^Password/),{target:{value:'long-password-123'}});
    fireEvent.click(screen.getByText('Request campus access'));
    await waitFor(() => expect(mocks.signup).toHaveBeenCalledWith({fullName:'Campus Lead',campusId:'campus',username:'campus_lead',password:'long-password-123'}));
    await screen.findByText('Continue to sign in');
    expect(mocks.signin).not.toHaveBeenCalled();
  });
  it('accepts a username login and preserves a visible authentication failure', async () => {
    mocks.signin.mockRejectedValue(new Error('Unable to sign in. Check your username or email and password.'));
    render(createElement(AuthPage,{mode:'login'}));
    expect((screen.getByLabelText('Username or email') as HTMLInputElement).type).toBe('text');
    fireEvent.change(screen.getByLabelText('Username or email'),{target:{value:'campus_lead'}});
    fireEvent.change(screen.getByLabelText('Password'),{target:{value:'wrong'}});
    fireEvent.click(screen.getByText('Sign in'));
    await screen.findByRole('alert');
    expect(mocks.signin).toHaveBeenCalledWith('campus_lead','wrong');
  });
  it('rejects invalid usernames before signup', async () => {
    render(createElement(AuthPage,{mode:'signup'}));
    await screen.findByText('Campus');
    fireEvent.change(screen.getByLabelText('Your name'),{target:{value:'Campus Lead'}});
    fireEvent.change(screen.getByLabelText('University'),{target:{value:'campus'}});
    fireEvent.change(screen.getByLabelText(/^Username/),{target:{value:'bad name'}});
    fireEvent.change(screen.getByLabelText(/^Password/),{target:{value:'long-password-123'}});
    fireEvent.click(screen.getByText('Request campus access'));
    await waitFor(() => expect(screen.getAllByText('Use 3–30 lowercase letters, numbers or underscores.')).toHaveLength(2));
    expect(mocks.signup).not.toHaveBeenCalled();
  });
  it('keeps internal email hidden and allows adding an optional verified address', async () => {
    const changed=vi.fn();
    render(createElement(ProfileView,{profile:{id:'user',username:'campus_lead',email:'uid@accounts.kocm.invalid',full_name:'Campus Lead',role:'campus',status:'active',campus_id:'campus',created_at:''},onChange:changed}));
    const email=screen.getByLabelText(/^Notification email/) as HTMLInputElement;
    expect(email.value).toBe('');
    expect(document.body.textContent).not.toContain('accounts.kocm.invalid');
    expect(document.querySelector('input[hidden]')?.getAttribute('value')).toBe('campus_lead');
    fireEvent.change(email,{target:{value:'lead@example.test'}});
    fireEvent.change(screen.getByLabelText(/^Current password for email verification/),{target:{value:'current-password'}});
    fireEvent.click(screen.getByText('Add email'));
    await waitFor(() => expect(mocks.attach).toHaveBeenCalledWith('lead@example.test','current-password'));
    await screen.findByText('We sent a confirmation link to lead@example.test. Your email changes once you click it.');
    fireEvent.change(screen.getByLabelText(/^Username/),{target:{value:'new_lead'}});
    fireEvent.click(screen.getByText('Save username'));
    await waitFor(() => expect(mocks.username).toHaveBeenCalledWith('new_lead'));
    await screen.findByText('Your username has been updated. Use it next time you sign in.');
    expect(changed).toHaveBeenCalled();
  });
  it('explains recovery without a verified email', () => {
    render(createElement(AuthPage,{mode:'forgot'}));
    expect(screen.getByText(/If you have not added a verified email/)).toBeTruthy();
  });
});

it('shows email delivery configuration failure without claiming a message was sent',async()=>{
 mocks.attach.mockRejectedValue(new Error('Email verification sender is not configured yet. Your account email has not been changed.'));
 render(createElement(ProfileView,{profile:{id:'user',username:'campus_lead',email:'uid@accounts.kocm.invalid',full_name:'Campus Lead',role:'campus',status:'active',campus_id:'campus',created_at:''},onChange:vi.fn()}));
 fireEvent.change(screen.getByLabelText(/^Notification email/),{target:{value:'lead@example.test'}});
 fireEvent.change(screen.getByLabelText(/^Current password for email verification/),{target:{value:'current-password'}});
 fireEvent.click(screen.getByText('Add email'));
 expect((await screen.findByRole('alert')).textContent).toBe('Email verification sender is not configured yet. Your account email has not been changed.');
 expect(screen.queryByRole('status')).toBeNull();
});
