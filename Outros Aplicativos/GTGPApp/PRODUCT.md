# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Google Apps Script HTML Service bound to a Google Sheet, with a Vite and React interface using local shadcn/ui components. A standalone HTML build provides an offline visual preview.

## Users

Primary users are inferred to be internal GT/GP program operators who need to review trainee profiles and evaluation data. This audience assumption can be corrected later.

## Product Purpose

Provide a simple read-only dashboard for data that the user pastes into a dedicated Google Sheet. Success means operators can understand the current data, find a person, review every supplied field, and spot incomplete or inconsistent records.

## Positioning

The MVP reads the user's one manually maintained GT/GP Sheet and joins its two tables by Matricula. Users keep control of the source records in Sheets; the app focuses on useful views and checks.

## Operating Context

The workbook supplied for the prototype contains synthetic data. The newly created Google Sheet is intentionally blank apart from its schema and instructions. Users paste their data there. The application is served by Google Apps Script and has an independent local HTML preview.

## Capabilities and Constraints

- Source tabs: `Base_Principal` and `TB_Agente`, joined by `Matricula`.
- Support a dashboard, people search and detail, evaluation views, data-quality checks, spreadsheet navigation, and XLSX export.
- The application reads the current spreadsheet; record entry and corrections happen directly in Google Sheets.
- No Microsoft Graph, SharePoint, Power Automate, or other Microsoft integration in this MVP.
- No personal or other real-company data is included in the demo dataset; the supplied workbook was confirmed as simulated.
- The deployed web app must remain restricted to the deploying user unless the user later asks to broaden access.

## Brand Commitments

- Use the Usiminas green `#84bd00` and a dark green.
- Use a desktop-style application shell with sidebar navigation, clear and useful visualization screens, and shadcn/ui components wherever practical.
- Keep the interface simple, intuitive, and focused on the data.

## Evidence on Hand

- `../../dashboardGTGP/Base GTGP.xlsx` is the supplied synthetic workbook used to understand the two source schemas and provide local preview data.
- Google Sheet: [GT-GP - Base de Dados (MVP)](https://docs.google.com/spreadsheets/d/1LU6Vej6ZgEx_urYH-I4JyDss2Tl8fsWNc2NvZAtIBdw/edit), created with blank data tabs and paste instructions.

## Product Principles

- Keep the Google Sheet as the editable source of truth.
- Show missing values as missing; never count them as zero.
- Make the relationship between the two tabs and any join issues visible.
- Keep all source fields available in the people detail view.
- Label all records in the offline preview as synthetic.
