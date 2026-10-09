// @vitest-environment jsdom
import {createElement} from "react";
import {cleanup,render,screen} from "@testing-library/react";
import {afterEach,expect,it} from "vitest";
import {ApprovalAccountIdentity} from "../app/dashboard";
afterEach(cleanup);
it("shows the username on pending approval instead of an internal authentication alias",()=>{render(createElement(ApprovalAccountIdentity,{profile:{full_name:"Test Applicant",username:"campus_applicant"}}));expect(screen.getByText("Signed in as @campus_applicant")).toBeTruthy();expect(document.body.textContent).not.toContain("accounts.kocm.invalid");});
it("uses the account name when no username is assigned",()=>{render(createElement(ApprovalAccountIdentity,{profile:{full_name:"Test Applicant",username:null}}));expect(screen.getByText("Signed in as Test Applicant")).toBeTruthy();});
