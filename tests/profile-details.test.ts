// @vitest-environment jsdom
import { createElement } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
const save = vi.hoisted(() => vi.fn());
vi.mock('../lib/koc', () => ({updateOwnProfile:save,changeOwnEmail:vi.fn(),changePassword:vi.fn(),adminSetEmail:vi.fn(),friendly:(e:Error) => e.message,ROLE_LABELS:{campus:'Campus rep'}}));
import ProfileView from '../app/views/profile';
afterEach(() => {cleanup();save.mockReset();});
describe('personal profile details', () => {
  it('loads personal fields and saves them without user role or campus changes', async () => {
    save.mockResolvedValue({});const changed = vi.fn();
    render(createElement(ProfileView,{profile:{id:'u',full_name:'Campus Lead',email:'lead@example.test',role:'campus',status:'active',campus_id:'c',phone:'+44 7700 900123',course:'Law',study_year:2,bio:'Lead',created_at:''},onChange:changed}));
    expect((screen.getByLabelText('Course') as HTMLInputElement).value).toBe('Law');
    fireEvent.change(screen.getByLabelText('Course'),{target:{value:'History'}});
    fireEvent.change(screen.getByLabelText('Year of study'),{target:{value:'3'}});
    fireEvent.click(screen.getByText('Save profile'));
    await waitFor(() => expect(save).toHaveBeenCalledWith({fullName:'Campus Lead',phone:'+44 7700 900123',course:'History',studyYear:3,bio:'Lead'}));
    expect(changed).toHaveBeenCalled();
    await screen.findByText('Your personal profile has been updated.');
  });
  it('keeps a server validation error visible', async () => {
    save.mockRejectedValue(new Error('Enter a phone number with 7 to 15 digits, or leave it blank.'));
    render(createElement(ProfileView,{profile:{id:'u',full_name:'Campus Lead',email:'lead@example.test',role:'campus',status:'active',campus_id:'c',created_at:''},onChange:vi.fn()}));
    fireEvent.click(screen.getByText('Save profile'));
    await screen.findByText('Enter a phone number with 7 to 15 digits, or leave it blank.');
  });
});
