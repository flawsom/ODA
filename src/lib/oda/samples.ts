// Sample correspondence so the demo is fully exercisable without uploading files.

export interface SampleDoc {
  name: string;
  text: string;
  mimeType: string;
}

export const SAMPLES: SampleDoc[] = [
  {
    name: "LC-Out_Transfer-Order_Bhaskar-Sinha_RNJ-31-1512.txt",
    mimeType: "text/plain",
    text: `No. RNJ/31-1512/2026
Office of the Regional Registrar of Cooperatives
Sector 14, New Ranaghat
Date: 12 February 2026

To,
Shri Bhaskar Kumar Sinha
Accounts Officer (Grade II)
Regional Cooperative Bank, Ranaghat Branch

Subject: L.C.-Out Transfer Order — posting to Nalanda Regional Office

Sir,

Reference your application No. APP/88-214 dated 08 January 2026 and in continuation of
Office Order No. OO/2026/117 dated 28 January 2026, this office hereby issues the
L.C.-Out order placing you on transfer from the Ranaghat Branch to the Nalanda Regional
Office with effect from the forenoon of 02 March 2026.

You are directed to:
1. Hand over charge of all records, cash and stationery in your custody to Shri
   Ramesh Pandey, Senior Accounts Officer, who has been appointed to receive the charge.
2. Submit the charge report and stock verification statement (VV) to this office
   within 3 working days of relief.
3. Report for joining at the Nalanda Regional Office on or before 02 March 2026.

Your joining report should be submitted to the Regional Director, Nalanda. TA/DA and
transfer grant shall be admissible as per departmental rules. Any dues recoverable
from your salary shall be adjusted against the transfer grant as per the VV statement.

This issues with the approval of the Regional Director.

Yours faithfully,
sd/-
(M. Chatterjee)
Deputy Registrar`,
  },
  {
    name: "Complaint_Non-Delivery-Pension_P-Wing-Digilocker.txt",
    mimeType: "text/plain",
    text: `Date: 18 March 2026

To,
The Commissioner
Department of Pensions & Welfare
P-Wing, Civil Lines, New Delhi

Subject: Complaint regarding non-delivery of pension for January–February 2026

Respected Sir/Madam,

I, Smt. Usha Rani Devi, pensioner bearing PPO No. PPO/D-77412, hereby lodge a formal
complaint regarding the non-crediting of my pension for the months of January and
February 2026 to my account with the State Bank of India (A/C No. 40213577890, IFSC
SBIN0001142).

Despite submitting the life certificate through DigiLocker on 05 January 2026 and
receiving acknowledgement Ref. No. DL/2026/88453, the payment has not been released.
I have visited the pension disbursing office three times and called the helpline on
each occasion; no resolution has been provided so far.

This delay has caused severe hardship to me and my family. I request that the matter
be examined urgently and my pending pension be credited at the earliest, along with
interest as per rules.

I have enclosed a copy of the acknowledgement and my PPO for reference.

Yours faithfully,
(Usha Rani Devi)
Pensioner, PPO/D-77412
Contact: 9876543210`,
  },
  {
    // Real-world Indian government letter (CMPFO) — the "Sub:- / Ref:-" hyphen
    // format, a To-block, and a table. This is the exact shape of the document
    // that v1 of the engine mangled (subject fell back to a random line, the
    // reference captured "Region" from "Region-III", recipient was a table
    // name). It stays here as a permanent regression test.
    name: "L.C.-Out_Ledger-Cards_CMPFO-RNJ-21-14.txt",
    mimeType: "text/plain",
    text: `CPF/118/Misc./L.C.-Out/RNJ-21 & 14/R-I/ASN/
Date: 09-07-2026

To,
The Assistant Commissioner
Coal Mines Provident Fund Organisation
B.B. College Road
Asansol, Region-III
District. Paschim Burdwan - 713303
West Bengal

Sub:- Inter Regional Transfer of Ledger Card.
Ref:- CPF/59/L.C.-Req./BKR-32/R-III/ASN/41 dated 07/07/2026

Sir,

In view of the revised Procedures prescribed in Procedure Office Order No-35 dated 12.02.1975 of CMPF Commissioner, Dhanbad, I am to state that the Ledger Cards of the under mentioned members are hereby forwarded to your Regional Office.
It is also intimated that Form A and P.S.-3 and P.S.-4 forms are not available in this Region.

It has been ensured that the posting in the Ledger Cards have been made/updated for the periods the member were working in this Region.

SL. No | Name of the Member | CMPF A/C No | Name of the colliery where the member had earlier worked in | Name of the colliery where the member is currently working in | No. of LC
1 | Shri Tonmoy Bhattacharjee | RNJ/21/1964 | Khandra Coll., Bankola Area (From 20.04.2015 to 05.06.2025) Bankola Area Office (From 06.06.2025 to 31.08.2025) | ECL HQ. ECL | 1
2 | Shri Hirok Sarkar | NGP/64/79 | Bankola AHQ, Bankola ECL (From 02.08.2021 to 18.08.2024) | ECL HQ. ECL | 1

Please acknowledge the receipt of the above at the earliest.

Yours faithfully,
sd/-
(Ajay Kumar Singh)
Regional Commissioner - I`,
  },
  {
    // Extract-Out — the second reference-standard CMPFO letter shape: file
    // number + date on one line, "वीवी विवरण के उद्धरण" subject, prose reference
    // ("your office letter No. … dated …"), and the Extract-Out body with a
    // member name and account code captured into the translated sentence.
    name: "Extract-Out_VV-Details_Ravindra-Yadav_RNJ-12-1011.txt",
    mimeType: "text/plain",
    text: `CPF/118/Misc./RNJ-16/Extract-Out/R-I/ASN/
Date: 23-03-2026

To,
The Regional Commissioner
CMPF, Singrauli
PO-Jayant, District-Singrauli - 486890
Madhya Pradesh

Sub:- Supply of Extract (VV Details).
Ref:- Your office letter No. CPF/16/Sing/13/25 dated 26/03/2026

Sir,

In view of the above subject and reference, the extract of VV details of Shri Ravindra Yadav, CMPF A/C No.- RNJ/12/1011 is forwarded herewith for your perusal.

Yours faithfully,
sd/-
(Ajay Kumar Singh)
Regional Commissioner - I
Encl- As above`,
  },
];
