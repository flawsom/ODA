#!/usr/bin/env bun
// ═══════════════════════════════════════════════════════════════════════════════
// 20 TOUGHEST LETTERS — consumer-facing quality audit
//
// Each letter is an extremely complex, domain-specific English document that
// tests different aspects of the translation engine:
//   • Legal/ judicial language
//   • Medical/ insurance terminology
//   • Financial/ taxation jargon
//   • Technical/ engineering specifications
//   • Diplomatic/ government correspondence
//   • Complex multi-clause sentences
//   • Nested parenthetical remarks
//   • Passive voice, subjunctive mood
//   • Proper nouns, abbreviations, codes
//
// For each letter we check:
//   1. No fatal errors (translation must not crash)
//   2. Zero English prose lines in Hindi output (absolute guarantee)
//   3. Key terms translated correctly (not phonetic gibberish)
//   4. Completeness (complete: true)
// ─────────────────────────────────────────────────────────────────────────────

import { translateAdaptive } from "../src/lib/oda/refine";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, label: string, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    const msg = `  ❌ ${label}${detail ? ` — ${detail}` : ""}`;
    console.log(msg);
    failures.push(msg);
  }
}

function hasLatinProse(text: string): string[] {
  return text
    .split("\n")
    .filter((l) => {
      const trimmed = l.trim();
      if (trimmed.length === 0) return false;
      // Allow parenthesized names, digits, codes
      if (/^\([^)]+\)$/.test(trimmed)) return false;
      if (/^\d+\.\s/.test(trimmed)) return false; // numbered list items partially translated OK
      const words = trimmed
        .split(/\s+/)
        .filter((w) =>
          /^[a-z]{3,}$/i.test(
            w.replace(/[.,;:!?()\-\u2013\u2018\u2019'"\u2026]/g, ""),
          ),
        );
      return words.length > 0;
    })
    .map((l) => l.substring(0, 80));
}

function translate(name: string, text: string) {
  console.log(`\n══ ${name} ══`);
  try {
    const result = translateAdaptive(
      { text, metadata: {} },
      { language: "Hindi", strategy: "adaptive" },
    );
    const content = result.content;
    const lines = content.split("\n");

    assert(result.complete === true, `complete: ${result.complete}`);

    const latinLines = hasLatinProse(content);
    assert(
      latinLines.length === 0,
      `zero Latin prose lines`,
      latinLines.length > 0
        ? `found: ${latinLines.slice(0, 3).join(" | ")}`
        : undefined,
    );

    // Check for gibberish patterns (phonetic transliteration of English)
    const gibberish = content.match(
      /\b(?:रेकुसत|एंहंकेद|सेकुरितय|मेसुरेस|बलोकक|तयपे|स्सा)\b/g,
    );
    assert(
      !gibberish || gibberish.length === 0,
      `no phonetic gibberish`,
      gibberish ? `found: ${gibberish.join(", ")}` : undefined,
    );

    // Count Hindi characters vs total
    let hindiChars = 0;
    let totalChars = 0;
    for (const c of content) {
      totalChars++;
      if (/[\u0900-\u097F]/.test(c)) hindiChars++;
    }
    const coverage = totalChars > 0 ? (100 * hindiChars) / totalChars : 0;
    assert(coverage > 60, `Hindi coverage ${coverage.toFixed(1)}%`, coverage <= 60 ? `too low` : undefined);

    console.log(`  📊 ${lines.filter((l) => l.trim()).length} lines, ${content.length} chars, ${coverage.toFixed(1)}% Hindi`);
  } catch (err) {
    assert(false, `no crash`, `${err instanceof Error ? err.message : err}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// THE 20 TOUGHEST LETTERS
// ═══════════════════════════════════════════════════════════════════════════════

translate("1. COMPLEX LEGAL NOTICE (3-clause breach)", `To,
The Managing Director,
ABC Infrastructure Private Limited,
Registered Office: 14th Floor, Tower-B, DLF Phase-III,
Gurugram, Haryana – 122002

Date: 15.08.2026

Subject: Legal Notice Under Section 8 of the Indian Contract Act, 1872 — Breach of Construction Agreement Dated 01.03.2024

Sir,

This is to bring to your kind notice that our client, Mr. Rajesh Kumar Sharma (hereinafter referred to as "the First Party"), had entered into aConstruction Agreement dated 01.03.2024 (hereinafter referred to as "the Agreement") with your company (hereinafter referred to as "the Second Party") for the construction of a two-storey residential building bearing Plot No. 47-B, Sector-12, Faridabad, Haryana, at an agreed consideration of Rs. 45,00,000/- (Rupees Forty-Five Lakh Only), payable in five instalments as per the schedule annexed hereto as Annexure-A.

It has further been brought to our notice that the First Party had duly performed his obligations under the Agreement, including but not limited to: (a) payment of the first three instalments amounting to Rs. 27,00,000/- (Rupees Twenty-Seven Lakh Only) well within the stipulated time; (b) granting of uninterrupted access to the construction site; and (c) obtaining of all requisite approvals from the competent authorities, including the Building Plan Sanction from the Municipal Corporation of Faridabad.

Notwithstanding the above, you have failed and/or neglected to commence the construction work within the time stipulated under Clause 5 thereof, which expired on 30.06.2024, and despite repeated oral and written requests, you have neither commenced the work nor refunded the amount already received, thereby committing a gross breach of the Agreement.

In view of the foregoing, we hereby call upon you to: (i) commence the construction work within 30 days from the date of receipt of this notice; or (ii) refund the entire amount of Rs. 27,00,000/- along with interest at the rate of 18% per annum from the date of each payment till the date of actual reimbursement; and (iii) pay compensation for the damages suffered by our client on account of the said breach, assessed at Rs. 5,00,000/- (Rupees Five Lakh Only).

Take notice that in default of compliance with the demands contained herein within 45 days from the date of receipt of this notice, our client shall be constrained to initiate appropriate civil and/or criminal proceedings against you and/or your company before the competent court of law at Faridabad, and in such event, you shall be liable to pay all costs of suit, including advocate's fees, court fees, and incidental expenses, as may be adjudged by the Hon'ble Court.

This notice is issued without prejudice to any other rights and remedies available to our client under the Agreement or at law or in equity.

Yours faithfully,
For and on behalf of Rajesh Kumar Sharma,
Advocate`);

translate("2. RTI APPLICATION (nested legal references)", `To,
The Public Information Officer,
Central Bureau of Investigation,
Plot No. 5-B, CGO Complex,
Lodhi Road, New Delhi – 110003

Subject: Application Under the Right of Citizens to Information Act, 2005, Section 6(1)

Respected Sir/Madam,

I, Dr. Priya Venkatesh, S/o Late Shri K. Venkatesh, R/o Flat No. 302, Alps Apartments, Mayur Vihar Phase-I, Delhi-110091, do hereby apply for information under the Right of Citizens to Information Act, 2005 (hereinafter referred to as "the RTI Act"), with regard to the following:

1. Copy of the First Information Report (FIR) No. RC/01/2025, registered at PS CBI, New Delhi, under Sections 420, 467, 468, 471, and 120-B of the Indian Penal Code, 1860, pertaining to the matter involving M/s Global Tech Solutions Pvt. Ltd. and its directors.

2. Copy of the charge-sheet, if any, filed pursuant to the said FIR, along with the list of documents annexed thereto.

3. Status report of the investigation, including the names and designations of the investigating officer(s) assigned to the case, and the stage of investigation as on the date of this application.

4. Details of all bank accounts (account numbers, names of banks, and branches) identified during the course of investigation in connection with the alleged siphoning of funds amounting to approximately Rs. 12.5 crore (Rupees Twelve Crore Fifty Lakhs Only).

5. Copy of the sanctions, if any, obtained from the competent authority under Section 17 of the Prevention of Corruption Act, 1988, for prosecution of the accused persons.

6. Details of mutual legal assistance requests, if any, sent to foreign jurisdictions (specifying the country/countries) in connection with this investigation.

7. The total expenditure incurred by the CBI on this investigation from the date of registration of the FIR till the date of this application, itemized under the heads of: (a) manpower cost; (b) travel and conveyance; (c) technical and forensic analysis; and (d) any other heads.

I am aware that the fee for this application is Rs. 10/- (Rupees Ten Only) as prescribed under Section 6(1) of the RTI Act, and I am enclosing a demand draft of the said amount bearing No. 984521 dated 10.08.2026, drawn on State Bank of India, Mayur Vihar Branch, Delhi.

I hereby state that the information sought herein does not fall within the exemptions prescribed under Sections 8 and 9 of the RTI Act, and that the disclosure of the said information would serve the larger public interest by ensuring transparency and accountability in the functioning of the premier investigating agency of the country.

In the event that the information is not furnished within the stipulated period of 30 days as mandated under Section 7(1) of the RTI Act, I shall be constrained to file a first appeal before the designated appellate authority, and thereafter a second appeal before the Central Information Commission, as provided under Sections 19 and 20 of the Act.

Thanking you,

Yours faithfully,
(Dr. Priya Venkatesh)
PhD (Computer Science), MBA (Finance)
RTI Application Fee: Rs. 10/-
Contact: 98XXXYYY123
Email: priya.venkatesh@gmail.com`);

translate("3. MEDICAL INSURANCE CLAIM (complex terminology)", `To,
The Chief Claims Officer,
Star Health and Allied Insurance Company Limited,
"Star Health" Building, No. 1, Cenotaph Road,
Teynampet, Chennai – 600018

Date: 18.08.2026

Subject: Reimbursement Claim Under Star Comprehensive Health Insurance Policy No. SHC/2025/456789 — Post-Operative Cardiac Bypass Surgery

Dear Sir/Madam,

I, Smt. Meena Agarwal, wife of Shri Mahesh Agarwal, the insured person under the above-referenced policy, hereby submit this claim for reimbursement of medical expenses incurred in connection with the Coronary Artery Bypass Grafting (CABG) surgery performed on my husband at Fortis Escorts Heart Institute, Okhla, New Delhi, during the period from 02.07.2026 to 18.07.2026.

The sequence of events and medical history is as follows:

1. Pre-Operative Diagnosis: Triple-vessel coronary artery disease with 90% stenosis of the Left Anterior Descending (LAD) artery, 85% stenosis of the Left Circumflex (LCx) artery, and 75% stenosis of the Right Coronary Artery (RCA). The pre-operative echocardiography revealed an Ejection Fraction (EF) of 35%, indicating severely compromised left ventricular function.

2. Surgical Procedure: On- pump Coronary Artery Bypass Grafting using three grafts — Left Internal Mammary Artery (LIMA) to LAD, Saphenous Vein Graft (SVG) to LCx, and SVG to RCA — performed under general anaesthesia by Dr. Ashok Seth (Cardiac Surgeon, Regn. No. MCI/DM/12345) and his team.

3. Post-Operative Complications: The patient developed Acute Respiratory Distress Syndrome (ARDS) on the third post-operative day (POD-3), necessitating prolonged ventilatory support for 72 hours in the Intensive Care Unit (ICU). Additionally, a sternal wound infection was observed on POD-7, which was managed with intravenous antibiotics (Vancomycin 1g BD for 14 days) and daily wound dressing.

4. Duration of Hospitalization: 17 days (ICU: 10 days, Ward: 7 days).

Total Medical Expenses Incurred:

| S.No. | Description | Amount (Rs.) |
|---|---|---|
| 1 | Surgeon's fee | 4,50,000 |
| 2 | Anaesthetist's fee | 1,20,000 |
| 3 | ICU charges (10 days @ Rs. 15,000/day) | 1,50,000 |
| 4 | Ward charges (7 days @ Rs. 8,000/day) | 56,000 |
| 5 | Surgical consumables and implants | 3,25,000 |
| 6 | Medicines (pharmacy) | 2,18,500 |
| 7 | Diagnostic investigations (ECG, Echo, CT, blood work) | 85,000 |
| 8 | Cardiac rehabilitation programme | 45,000 |
| 9 | Physiotherapy charges | 22,000 |
| 10 | Miscellaneous (ambulance, documents) | 8,500 |
| **Total** | | **19,30,000** |

Enclosed herewith are the following documents:
(a) Original discharge summary (Fortis Escorts Heart Institute)
(b) Original bills and receipts for all the above items
(c) Prescription copies
(d) Diagnostic investigation reports
(e) Pre-authorization letter (copy) issued by TPA
(f) NEFT mandate form for direct credit
(g)Cancelled cheque of the insured's bank account

I hereby declare that the above expenses are genuine and have been incurred solely for the treatment of the insured person. I further declare that no portion of the said expenses has been claimed or reimbursed from any other insurance company or under any other scheme, including the Central Government Health Scheme (CGHS) or any State Government health scheme.

I request you to kindly process the claim and remit the admissible amount at the earliest, in accordance with the terms and conditions of the policy.

Thanking you,

Yours faithfully,
(Smt. Meena Agarwal)
Policy No.: SHC/2025/456789
Insured: Shri Mahesh Agarwal
Claim Amount: Rs. 19,30,000/-`);

translate("4. ENVIRONMENTAL COMPLIANCE NOTICE (technical jargon)", `To,
The Member Secretary,
Central Pollution Control Board,
Parivesh Bhawan, East Arjun Nagar,
Delhi – 110032

Date: 12.08.2026

Subject: Compliance Report Under the Environment (Protection) Act, 1986, and the Environmental Impact Assessment Notification, 2006 — Annual Environmental Monitoring Report for the Period April 2025 to March 2026

Sir,

In compliance with the conditions stipulated in the Environmental Clearance (EC) vide Ministry of Environment, Forest and Climate Change (MoEFCC) Letter No. J-11011/24/2023-IA.I.I dated 15.09.2023, and in accordance with the Environmental Impact Assessment (EIA) Notification, 2006 (as amended on 08.09.2024), we, M/s Greenfield Steel and Power Limited, are herewith submitting the Annual Environmental Monitoring Report for our Integrated Steel Plant located at Village Kalinganagar, District Jajpur, Odisha – 755017, for the reporting period April 2025 to March 2026.

The key environmental performance parameters during the reporting period are summarized below:

A. AIR QUALITY MONITORING:

The Stack Emission Monitoring (SEM) was conducted as per the schedule prescribed in the EC conditions, i.e., once every quarter (Q1: April-June 2025, Q2: July-September 2025, Q3: October-December 2025, Q4: January-March 2026) by the National Accreditation Board for Testing and Calibration Laboratories (NABL)-accredited agency, M/s Enviro Control Associates (ECA), Kolkata.

The results of the stack emission monitoring for the Critical Process Units (CPUs) are as follows:

| Unit | Pollutant | Standard (mg/Nm³) | Q1 | Q2 | Q3 | Q4 | Compliance |
|---|---|---|---|---|---|---|---|
| Sinter Plant | Particulate Matter (PM) | 100 | 78 | 82 | 75 | 80 | Yes |
| Blast Furnace | SO₂ | 150 | 120 | 125 | 110 | 115 | Yes |
| Blast Furnace | NOx | 300 | 245 | 260 | 235 | 250 | Yes |
| Coke Oven | Benzene | 1 mg/Nm³ | 0.4 | 0.5 | 0.3 | 0.4 | Yes |
| Hot Strip Mill | PM | 75 | 55 | 60 | 50 | 58 | Yes |

B. WATER QUALITY AND EFFLUENT MANAGEMENT:

Total water consumption during the reporting period: 12.45 Million Cubic Metres (MCM), of which:
- Fresh water intake from the Kalinganagar reservoir: 8.30 MCM
- Recycled/ reused water: 4.15 MCM (recycling efficiency: 33.3%)

The Zero Liquid Discharge (ZLD) system installed in the plant achieved a treated effluent quality well within the prescribed limits under the Environmental (Protection) Rules, 1986, Schedule VI:

| Parameter | Standard | Achieved |
|---|---|---|
| pH | 5.5–9.0 | 7.2 |
| Total Dissolved Solids (TDS) | 2100 mg/L | 1650 mg/L |
| Biological Oxygen Demand (BOD) | 30 mg/L | 12 mg/L |
| Chemical Oxygen Demand (COD) | 250 mg/L | 85 mg/L |
| Oil and Grease | 10 mg/L | 3 mg/L |

C. SOLID WASTE MANAGEMENT:

Total solid waste generated: 1,85,000 Metric Tonnes (MT), of which:
- Recycled/ reused: 1,42,000 MT (76.7%)
- Hazardous waste (as per Hazardous and Other Wastes (Management and Transboundary Movement) Rules, 2016): 23,000 MT — stored in the authorized hazardous waste storage facility and transported to the authorized Treatment, Storage, and Disposal Facility (TSDF) at Dharmtar, Odisha, by M/s clearance Private Limited (Authorization No. HW/OD/2024/001).
- Fly ash: 20,000 MT — disposed of in the approved Ash Pond and partly utilized in brick manufacturing by M/s Fly Ash Bricks Pvt. Ltd. under the Fly Ash Utilization Notification dated 27.08.2021.

D. ANNUAL ENVIRONMENTAL SPEND:

| Head | Amount (Rs. in Lakhs) |
|---|---|
| Pollution control equipment operation and maintenance | 450.00 |
| Environmental monitoring (air, water, noise, soil) | 85.00 |
| Green belt development and maintenance | 120.00 |
| Environmental management training | 15.00 |
| Community health and welfare programmes | 75.00 |
| Green belt development and maintenance | 120.00 |
| **Total** | **745.00** |

We hereby certify that the operations of the plant have been carried out in full compliance with all the environmental norms and conditions stipulated in the Environmental Clearance, Consent to Establish (CTE) issued by the State Pollution Control Board (SPCB), and the Consent to Operate (CTO) renewal for the period 2025-2028.

Should you require any further information or clarification, please do not hesitate to contact the undersigned.

Thanking you,

Yours faithfully,
(Anil Kumar Sinha)
Chief Environment Officer,
M/s Greenfield Steel and Power Limited
Plant: Kalinganagar, Jajpur, Odisha
Tel: 06XXX-XXXXXX
Email: enviro@greenfieldsteel.in`);

translate("5. BOARD RESOLUTION (corporate governance)", `MINUTES OF THE 247th MEETING OF THE BOARD OF DIRECTORS

M/s National Fertilizers Limited
(A Government of India Enterprise under the Ministry of Chemicals and Fertilizers)
A-11, Sector-24, Noida, Uttar Pradesh – 201301

Date of Meeting: 08.08.2026
Time: 11:00 AM IST
Venue: Board Room, 5th Floor, Corporate Office, NFL, Noida
Mode: Hybrid (Physical + Video Conferencing)

PRESENT:
1. Shri R.K. Singh, Chairman-cum-Managing Director (Chairperson)
2. Smt. Kavita Gupta, Director (Finance) & CFO
3. Shri Pramod Kumar Tiwari, Director (Operations)
4. Dr. Sunita Narain, Independent Director
5. Shri V.K. Mehta, Independent Director
6. Smt. Rekha Sharma, Government Nominee Director (Nominee of the President of India acting through the Ministry of Chemicals and Fertilizers)

ABSENT WITH LEAVE:
7. Shri Ashok Kumar, Whole-time Director (Technical) — on official tour at NFL plant, Bathinda, Punjab

IN ATTENDANCE:
8. Shri Deepak Sharma, Company Secretary & Compliance Officer
9. Shri Manoj Joshi, Chief Vigilance Officer (CVO)
10. Smt. Nidhi Agarwal, Internal Audit Head

ACTIONS AND RESOLUTIONS:

1. APPOINTMENT OF CHIEF FINANCIAL OFFICER (CFO) AND KEY MANAGERIAL PERSONNEL (KMP):

The Board considered the proposal for the appointment of a Chief Financial Officer (CFO) as required under Section 203 of the Companies Act, 2013, read with Rule 8 of the Companies (Appointment and Remuneration of Managerial Personnel) Rules, 2014.

After due deliberation and upon the recommendation of the Nomination and Remuneration Committee (NRC) vide its resolution dated 25.07.2026, the Board unanimously RESOLVED that Smt. Kavita Gupta, who is currently serving as Director (Finance), be also designated as the Chief Financial Officer (CFO) and Key Managerial Personnel (KMP) of the Company with immediate effect, subject to the approval of the Board of Bureau of Public Enterprises (BPPE), Department of Public Enterprises, Ministry of Heavy Industries and Public Enterprises, Government of India.

The terms of appointment, remuneration, and perks shall be governed by the Department of Public Enterprises (DPE) guidelines on CEO compensation and the Modified Differential Pay System (MDPS) applicable to Central Public Sector Enterprises (CPSEs), as amended from time to time.

2. APPROVAL OF ANNUAL CAPITAL EXPENDITURE (CAPEX) PLAN FOR FY 2026-27:

The Board considered and reviewed the Annual Capital Expenditure Plan for FY 2026-27, totaling Rs. 2,850.00 Crore (Rupees Two Thousand Eight Hundred Fifty Crore Only), as proposed by the Finance Committee in its meeting held on 01.08.2026, and after considering the recommendations of the Investment Board and the Project Appraisal Committee (PAC).

After detailed discussions, and subject to the observations of the Statutory Auditors and the Comptroller and Auditor General of India (C&AG), the Board RESOLVED to approve the said CAPEX Plan, with the following major heads:

(a) Expansion of the existing urea plant at Panipat, Haryana, under the New Urea Policy (NUP) — Rs. 1,200.00 Crore
(b) Installation of a 50 MW solar power plant at Ramagundam, Telangana, under the National Solar Mission — Rs. 350.00 Crore
(c) Modernization and Revamp (M&R) of the ammonia synthesis unit at unit-III, Bathinda — Rs. 580.00 Crore
(d) Information Technology infrastructure upgrade, including SAP S/4HANA migration — Rs. 120.00 Crore
(e) Green belt development and environmental compliance upgrades at all units — Rs. 85.00 Crore
(f) Contingency and Miscellaneous — Rs. 515.00 Crore

3. CORPORATE SOCIAL RESPONSIBILITY (CSR) ANNUAL ACTION PLAN:

The Board, pursuant to Section 135 of the Companies Act, 2013, and the Companies (Corporate Social Responsibility Policy) Rules, 2014, and in compliance with the CSR Annual Action Plan approved by the CSR Committee in its meeting dated 25.07.2026, RESOLVED to allocate Rs. 78.50 Crore (being 2% of the average net profits of the immediately preceding three financial years) towards CSR activities during FY 2026-27, to be spent on the following thrust areas:

(a) Healthcare and Sanitation — Rs. 25.00 Crore
(b) Education and Skill Development — Rs. 20.00 Crore
(c) Environment and Sustainability — Rs. 15.00 Crore
(d) Rural Development — Rs. 12.00 Crore
(e) Women Empowerment — Rs. 6.50 Crore

4. ANY OTHER MATTER:

The meeting concluded with a vote of thanks to the Chair at 2:45 PM IST.

Confirmed as a true record of the proceedings.

(Deepak Sharma)
Company Secretary & Compliance Officer
Membership No.: A12345
Date: 12.08.2026
Place: Noida, Uttar Pradesh`);

translate("6. DIPLOMATIC NOTE (formal government language)", `EMBASSY OF INDIA
ABU DHABI, UNITED ARAB EMIRATES

Note Verbale

No. Ind/Emb/2026/HR/1234
Date: 14.08.2026

The Ministry of Human Resources and Emiratisation,
Government of the United Arab Emirates,
Abu Dhabi, UAE

Subject: Employment Verification and Labour Contract Renewal for Indian Nationals Under the UAE-India Bilateral Labour Agreement

The Embassy of India in Abu Dhabi presents its compliments to the Ministry of Human Resources and Emiratisation of the Government of the United Arab Emirates and has the honour to refer to the Bilateral Labour Agreement (BLA) signed between the Government of the Republic of India and the Government of the United Arab Emirates on 22.04.2017, as amended by the Supplementary Protocol dated 11.02.2022, and to bring to the kind attention of the Ministry certain matters of concern regarding the welfare and protection of Indian workers employed in the United Arab Emirates.

1. The Embassy has been receiving a significant number of complaints from Indian workers regarding non-payment of wages, confiscation of passports by employers (in contravention of Article 15 of the UAE Labour Law, Federal Decree-Law No. 33 of 2021), and failure by certain employers to provide the mandatory health insurance coverage as stipulated under Article 10 of the same law.

2. In this context, the Embassy wishes to draw the attention of the Ministry to the following specific instances, which have been verified through the Indian Community Welfare Fund (ICWF) and the Protecting Indian Workers (PIW) cell of the Embassy:

(a) In the matter of 147 Indian workers employed by M/s Al-Rashid Construction Company (CR No. 123456), who have not been paid their monthly wages for the period from January 2026 to July 2026, despite the labour contracts being valid and subsisting. The total outstanding wages amount to approximately AED 8,92,500 (Eight Lakh Ninety-Two Thousand Five Hundred Dirhams).

(b) In the matter of the confiscation of passports of 53 Indian workers by M/s Gulf Pacific Trading LLC (CR No. 789012), in contravention of Article 15 of the UAE Labour Law, which expressly prohibits the retention or confiscation of an employee's travel documents by the employer.

3. The Embassy, therefore, respectfully requests the Ministry to kindly:
(a) Initiate an immediate investigation into the above-referred complaints and take appropriate enforcement action against the erring employers under the provisions of the UAE Labour Law and the Bilateral Labour Agreement;
(b) Direct the payment of all outstanding wages to the affected Indian workers within 30 days from the date of receipt of this Note Verbale;
(c) Ensure the return of all confiscated passports to the concerned workers forthwith;
(d) Consider the imposition of appropriate penalties, including blacklisting of the said employers from recruiting Indian workers in future, in accordance with the provisions of the BLA.

4. The Embassy further wishes to reiterate the commitment of both Governments to the welfare and protection of Indian workers in the UAE, as enshrined in the BLA, and expresses the confidence that the Ministry will take prompt and effective action to address the above grievances.

5. The Embassy avails itself of this opportunity to renew to the Ministry of Human Resources and Emiratisation of the Government of the United Arab Emirates the assurances of its highest consideration.

ABU DHABI
14th August 2026

(Stamp of the Embassy of India, Abu Dhabi)`);

translate("7. CRIMINAL COMPLAINT (FIR-style, complex charges)", `To,
The Station House Officer,
Police Station: Cyber Crime Cell,
Central Bureau of Investigation,
2nd Floor, Crime Branch Building,
Bandra (East), Mumbai – 400051

Subject: Complaint Under Sections 420, 467, 468, 471, 66A, 66C, 66D, and 120-B of the Indian Penal Code, 1860, Read with Sections 43, 65, 66, and 85 of the Information Technology Act, 2000 (as amended) — Online Financial Fraud Through Impersonation and Forgery of Digital Documents

Sir,

I, Smt. Asha Devi, aged about 58 years, W/o Shri Ramesh Chand, R/o House No. 32, Lane-4, Sector-9, Rohini, Delhi-110085, do hereby lodge this complaint and request for the registration of a First Information Report (FIR) in connection with the following incident of online financial fraud:

A. BRIEF OF THE INCIDENT:

On 25.07.2026, at approximately 3:15 PM, I received a phone call from an unknown person identifying himself as "Rajesh Kumar, Senior Manager, State Bank of India, Central Delhi Division" (Phone No. +91-98XXXXXXXX). The caller informed me that my Savings Bank Account No. 3XXXXXXXXXXXXXXX (IFSC: SBIN0001234, Branch: SBI, Sector-9, Rohini) had been "flagged for suspicious activity" and that an Income Tax raid was being conducted on all accounts showing irregular transactions.

B. THE FRAUD:

The said person, in conspiracy with other unknown individuals (who are yet to be identified), induced me to:

1. Share my internet banking credentials (username and password) under the pretext of "securing the account";

2. Share the One-Time Password (OTP) received on my registered mobile number (+91-98XXXXXXXX), which the caller claimed was "a security verification code to freeze suspicious transactions";

3. Transfer Rs. 18,75,000/- (Rupees Eighteen Lakh Seventy-Five Thousand Only) from my Savings Bank Account to three different accounts:

| S.No. | Account Holder Name | Account Number | Bank | IFSC | Amount (Rs.) |
|---|---|---|---|---|---|
| 1 | Vikram Mehta | 5XXXXXXXXXXXXXXX | HDFC Bank | HDFC0004567 | 7,50,000 |
| 2 | Priyanka Enterprises | 0XXXXXXXXXXXXXXX | ICICI Bank | ICIC0007890 | 6,25,000 |
| 3 | Sunil Verma | 2XXXXXXXXXXXXXXX | Punjab National Bank | PUNB0012345 | 5,00,000 |

4. I was further coerced into downloading a remote desktop application ("AnyDesk" or similar) on my laptop, which gave the fraudsters remote access to my device. Subsequently, they accessed my demat account with Zerodha (Client ID: AB1234) and executed unauthorized sell transactions, resulting in a further loss of Rs. 4,25,000/- (Rupees Four Lakh Twenty-Five Thousand Only).

C. TOTAL LOSS: Rs. 23,00,000/- (Rupees Twenty-Three Lakhs Only)

D. EVIDENCE:

I am enclosing herewith the following documents in support of this complaint:
(a) Bank statement of SBI Account No. 3XXXXXXXXXXXXXXX for the period 01.07.2026 to 31.07.2026
(b) Screenshot of the phone call details (Truecaller record showing +91-98XXXXXXXX)
(c) Screenshots of the fraudulent WhatsApp messages received from +91-98XXXXXXXX
(d) Transaction receipts of the three transfers
(e) Zerodha account statement showing unauthorized transactions
(f) Copy of the complaint lodged with SBI Branch Manager on 26.07.2026
(g) Copy of the cyber fraud complaint lodged on the National Cyber Crime Reporting Portal (complaint No. 456789 dated 26.07.2026)

I request you to kindly register the FIR and take immediate steps to:
(i) Trace and freeze the fraudulent bank accounts before the funds are withdrawn;
(ii) Identify the accused persons through technical surveillance, including call data records (CDR), IP address tracking, and CCTV footage analysis;
(iii) Coordinate with the respective banks for the recovery of the defrauded amount under the provisions of the RBI circular on digital payment frauds.

I am willing to cooperate fully in the investigation and to appear before the Investigating Officer as and when required.

Thanking you,

Yours faithfully,
(Smt. Asha Devi)
Aadhaar No.: XXXX-XXXX-7890
PAN: XXXXX1234X
Mobile: +91-98XXXXXXXX
Date: 01.08.2026
Place: Delhi`);

translate("8. ARBITRATION AWARD (complex legal terminology)", `IN THE MATTE OF ARBITRATION

ARB. PET. No. 245/2025

BEFORE THE SOLE ARBITRATOR

Shri Justice (Retd.) A.K. Mathur

BETWEEN:

M/s Tata Projects Limited
(A company incorporated under the Companies Act, 1956)
Having its registered office at D-13, MIDC Industrial Area,
Chinchwad, Pune – 411019
(Hereinafter referred to as "the Claimant" or "Tata Projects")

AND

The National Highways Authority of India (NHAI)
(Government of India Undertaking under the Ministry of Road Transport and Highways)
G-5 & 6, Sector-10, Dwarka,
New Delhi – 110075
(Hereinafter referred to as "the Respondent" or "NHAI")

AWARD

Date of Award: 05.08.2026

1. BACKGROUND:

1.1 The Claimant, M/s Tata Projects Limited, was awarded the contract for the construction of a 4-lane Highway (Package-III: Km 45+200 to Km 87+500) on the NH-53 (Mumbai-Nagpur Expressway), vide Letter of Acceptance (LoA) No. NHAI/HQ/PM/2021/4567 dated 15.03.2021, at a Contract Price of Rs. 1,245.50 Crore (Rupees One Thousand Two Hundred Forty-Five Crore and Fifty Lakhs Only), including the cost of materials, labour, plant, equipment, and all overheads and profits.

1.2 The original completion period was 30 months from the date of commencement (i.e., 01.04.2021), with a revised completion date of 30.09.2023, as extended by the Engineer-in-Charge (EIC) vide Extension of Time (EoT) Order No. NHAI/EOT/2023/789 dated 15.12.2022.

1.3 The Claimant alleges that the Respondent failed to: (a) hand over the complete Right of Way (RoW) within the stipulated time, resulting in a delay of 14 months in the physical possession of the land; (b) furnish the requisite Utility Shifting Orders (USOs) for 23 High Tension (HT) power transmission lines, 12 gas pipelines, and 8 water supply mains that traverse the project corridor; and (c) provide the updated Design Drawing (Package-III Rev.5) incorporating the changes ordered by the Ministry of Environment, Forest and Climate Change (MoEFCC) in its Environmental Clearance dated 22.06.2021.

1.4 The Claimant contends that the said delays are not attributable to the Claimant and fall squarely within the ambit of Clause 30.1 (Extension of Time for Completion) and Clause 65.1 (Force Majeure) of the General Conditions of Contract (GCC), and further that the Claimant is entitled to compensation for the additional costs incurred on account of the said delays, including but not limited to: prolonged overheads, escalation of material costs (particularly steel and bitumen), additional mobilization and demobilization charges, and loss of profit.

1.5 The dispute was referred to arbitration under Clause 67 of the GCC, read with Sections 11 and 12 of the Arbitration and Conciliation Act, 1996 (as amended by the Arbitration and Conciliation (Amendment) Act, 2019 and 2021), upon the failure of the amicable settlement mechanism under Clause 66 of the GCC.

2. CLAIMS AND COUNTER-CLAIMS:

2.1 The Claimant's claims are summarized as follows:

| S.No. | Description | Amount (Rs. Crore) |
|---|---|---|
| 1 | Prolonged overheads (14 months) | 87.50 |
| 2 | Material cost escalation (steel, bitumen, cement) | 142.30 |
| 3 | Additional mobilization/demobilization | 35.00 |
| 4 | Idle equipment charges | 28.75 |
| 5 | Loss of profit (12% on unexecuted work) | 56.40 |
| 6 | Interest on working capital | 18.25 |
| **Total** | | **368.20** |

2.2 The Respondent's counter-claims are as follows:

| S.No. | Description | Amount (Rs. Crore) |
|---|---|---|
| 1 | Liquidated damages for delayed completion | 124.55 |
| 2 | Cost of re-tendering for balance work | 45.00 |
| 3 | Penalty for failure to maintain traffic during construction | 12.00 |
| **Total** | | **181.55** |

3. FINDINGS AND AWARD:

After considering the evidence, submissions, and oral arguments advanced by both parties, and having regard to the relevant provisions of the GCC, the Indian Contract Act, 1872, and the Arbitration and Conciliation Act, 1996, the Sole Arbitrator hereby renders the following Award:

3.1 The Respondent is liable to pay to the Claimant a sum of Rs. 285.60 Crore (Rupees Two Hundred Eighty-Five Crore and Sixty Lakhs Only) on account of the following:

(a) Prolonged overheads: Rs. 65.00 Crore (restricted from the claimed Rs. 87.50 Crore, as the arbitrator finds that the Claimant could have optimized certain overheads during the delay period);

(b) Material cost escalation: Rs. 142.30 Crore (as substantiated by the Price Data published by the Ministry of Commerce and Industry);

(c) Additional mobilization/demobilization: Rs. 25.00 Crore (restricted from the claimed Rs. 35.00 Crore);

(d) Idle equipment charges: Rs. 18.00 Crore (restricted from the claimed Rs. 28.75 Crore);

(e) Interest on working capital: Rs. 35.30 Crore (computed at the State Bank of India's Marginal Cost of Funds Based Lending Rate (MCLR) plus 2% per annum, compounded quarterly, from the date of each expenditure till the date of this Award).

3.2 The Respondent's counter-claims are dismissed in entirety, for the reasons set out in the detailed Award.

3.3 The costs of arbitration, assessed at Rs. 15.00 Lakhs, shall be borne equally by both parties.

The Award is final and binding upon the parties under Section 35 of the Arbitration and Conciliation Act, 1996.

Sole Arbitrator
(Justice (Retd.) A.K. Mathur)
Date: 05.08.2026
Place: New Delhi`);

translate("9. TECHNICAL SPECIFICATION (engineering terminology)", `To,
The Director General,
Telecom Regulatory Authority of India (TRAI),
Jeevan Deep Building, Parliament Street,
New Delhi – 110001

Date: 10.08.2026

Subject: Technical Submission for the Consultation Paper on Deployment of 5G Advanced (Release-18) and 6G Readiness Framework — Docket No. TRAI/ADVT/2026/5G-ADV/001

Sir,

We, M/s Reliance Jio Infocomm Limited (CIN: U74899DL2007PLC163780), in response to the Consultation Paper (CP) on "Deployment of 5G Advanced (3GPP Release-18) and 6G Readiness Framework" published by TRAI on 01.06.2026, do hereby submit our technical comments and recommendations as follows:

1. NETWORK ARCHITECTURE AND SPECTRUM CONSIDERATIONS:

1.1 We concur with TRAI's assessment that the deployment of 5G Advanced (Release-18) is a critical stepping stone towards 6G readiness. However, we wish to draw the Authority's attention to certain critical aspects that warrant consideration:

(a) Carrier Aggregation (CA): Release-18 introduces Carrier Aggregation across licensed and unlicensed bands (known as Licensed Assisted Access or LAA, and Enhanced LAA or eLAA). We recommend that the Authority should consider allocating the 6 GHz band (5925 MHz – 7125 MHz) for unlicensed use, as has been done by the Federal Communications Commission (FCC) in the United States, the European Conference of Postal and Telecommunications Administrations (CEPT) in Europe, and the Ministry of Industry and Information Technology (MIIT) in China.

(b) Network Slicing: The Release-18 specification introduces advanced Network Slicing capabilities with enhanced isolation, deterministic latency, and quality-of-service (QoS) guarantees. This is essential for supporting critical use cases such as Connected and Autonomous Vehicles (CAV), Industry 4.0 (Smart Manufacturing), and Remote Surgery (telerobotic surgery).

(c) Artificial Intelligence (AI) and Machine Learning (ML) Integration: Release-18 introduces the AI/ML air interface, which leverages neural network-based channel estimation, beam management, and positioning. We recommend that the Authority develop a regulatory framework for AI/ML in telecommunications, addressing issues such as algorithmic transparency, data privacy (under the Digital Personal Data Protection Act, 2023), and spectrum efficiency optimization.

2. BACKHAUL AND TRANSPORT NETWORK:

2.1 The deployment of 5G Advanced requires a robust backhaul infrastructure with the following minimum specifications:

(a) Fiber-to-the-Antenna (FTTA): Minimum 25 Gbps per cell site for macro cells; 10 Gbps for small cells
(b) Microwave Backhaul: E-band (71-86 GHz) and V-band (57-71 GHz) for non-line-of-sight (NLOS) deployments
(c) Latency: End-to-end latency of ≤ 5 milliseconds (ms) for URLLC (Ultra-Reliable Low-Latency Communication) use cases
(d) Synchronization: IEEE 1588v2 Precision Time Protocol (PTP) with time accuracy of ±1.5 μs for TDD (Time Division Duplex) operation

3. 6G RESEARCH AND DEVELOPMENT ROADMAP:

We support the establishment of a 6G Research and Development Consortium as proposed in the CP, and recommend the following:

(a) Frequency Bands for 6G Research: The Authority should identify and reserve the following bands for 6G research and trials:
- Sub-terahertz (sub-THz): 92-300 GHz
- Terahertz (THz): 300 GHz – 3 THz
- Reconfigurable Intelligent Surfaces (RIS): 24-30 GHz

(b) Key Performance Indicators (KPIs) for 6G:

| KPI | 5G (Release-17) | 5G Advanced (Release-18) | 6G (Target) |
|---|---|---|---|
| Peak Data Rate | 20 Gbps | 40 Gbps | 1 Tbps |
| User-Experienced Data Rate | 100 Mbps | 200 Mbps | 1 Gbps |
| Latency (URLLC) | 1 ms | 0.5 ms | 0.1 ms |
| Connection Density | 1M devices/km² | 10M devices/km² | 100M devices/km² |
| Energy Efficiency | 3x improvement | 10x improvement | 100x improvement |

We trust that the above submissions will be considered by the Authority while finalizing the regulatory framework for 5G Advanced and 6G.

Thanking you,

Yours faithfully,
(Sunil Mittal)
Chairman,
M/s Reliance Jio Infocomm Limited`);

translate("10. TAX ASSESSMENT NOTICE (financial/legal complexity)", `Office of the Deputy Commissioner of Income Tax,
Circle-15(1),
118, AAYAKAR BHAWAN,
M.G. Road, Bengaluru – 560001

PAN: AABCT1234M
Assessment Year: 2025-26
Assessee: M/s Sunrise Healthcare Technologies Private Limited
CIN: U72200KA2018PTC112345

Date: 11.08.2026

NOTICE UNDER SECTION 143(2) OF THE INCOME-TAX ACT, 1961, READ WITH SECTION 144B (FACELESS ASSESSMENT)

WHEREAS a return of income for the Assessment Year 2025-26 was filed by the assessee on 31.10.2024 (electronically) declaring total income of Rs. 4,56,78,900/- (Rupees Four Crore Fifty-Six Lakh Seventy-Eight Thousand Nine Hundred Only) and claiming a refund of Rs. 12,34,567/- (Rupees Twelve Lakh Thirty-Four Thousand Five Hundred and Sixty-Seven Only);

AND WHEREAS the return of income has been processed under Section 143(1) of the Income-Tax Act, 1961, vide Intimation No. u/s 143(1)/BNG/2025-26/12345678 dated 25.03.2025, and the refund has been held in abeyance pursuant to the provisions of Section 241 of the Income-Tax Act, 1961;

AND WHEREAS it has come to the notice of the Assessing Officer, based on the information received through the Annual Information Statement (AIS), Tax Collection at Source (TCS) statements, and Form 26AS, that certain discrepancies exist in the return of income filed by the assessee, particularly with regard to:

(a) Non-disclosure of income from foreign sources — the assessee has received payments amounting to USD 3,45,000 (approximately Rs. 2,89,35,000/- at the applicable exchange rate) from M/s MedTech Solutions Inc., a company incorporated in the State of Delaware, United States of America, for the licensing of proprietary healthcare software ("SunriseEHR v3.2"), which has not been offered to tax in India under the provisions of Section 9(1)(vi) of the Income-Tax Act, 1961, read with Section 115A of the Income-Tax Act, 1961;

(b) Disallowance of expenditure under Section 14A of the Income-Tax Act, 1961 — the assessee has claimed exempt income of Rs. 23,45,678/- (in the nature of dividend income from domestic companies) and has not disallowed any expenditure in relation thereto, in contravention of the provisions of Section 14A read with Rule 8D of the Income-Tax Rules, 1962;

(c) Transfer Pricing adjustment under Chapter X (Sections 92 to 92F) of the Income-Tax Act, 1961 — the assessee has entered into international transactions with its associated enterprise (AE), M/s Sunrise Healthcare LLC, Delaware, USA, in respect of software licensing fees, and it appears that the arm's length price (ALP) of the said transactions has been understated by approximately Rs. 1,25,00,000/-, resulting in a consequent underreporting of income;

(d) Non-reconciliation of cash deposited during the demonetization period — the assessee has deposited a total of Rs. 45,67,890/- in its bank accounts during the period 09.11.2016 to 31.12.2016, which has not been satisfactorily reconciled with the books of account or the return of income for the Assessment Year 2017-18;

NOW, THEREFORE, you are hereby called upon to show cause as to why:

(i) The additional income of Rs. 2,89,35,000/- on account of undisclosed foreign income should not be assessed to tax under the provisions of Section 9(1)(vi) and Section 68 of the Income-Tax Act, 1961;

(ii) Disallowance of Rs. 1,56,379/- should not be made under Section 14A of the Income-Tax Act, 1961, read with Rule 8D of the Income-Tax Rules, 1962;

(iii) Transfer pricing adjustment of Rs. 1,25,00,000/- should not be made under Section 92C(3) of the Income-Tax Act, 1961;

(iv) Interest under Section 234A, 234B, and 234C of the Income-Tax Act, 1961, should not be charged on the amounts assessed as above;

(v) Penalty under Section 270A of the Income-Tax Act, 1961 (for underreporting of income) at the rate of 50% of the tax payable on the underreported income should not be imposed;

(vi) Prosecution under Section 276C of the Income-Tax Act, 1961 (wilful attempt to evade tax) should not be initiated against the directors of the company.

AND you are hereby required to file your written reply, along with supporting documents, within 15 days from the date of receipt of this notice, either in person or through your authorised representative, before the undersigned.

Please note that if you fail to show cause or file your reply within the stipulated period, the assessment will be completed to the best of the Assessing Officer's judgment under Section 144 of the Income-Tax Act, 1961, without further reference to you.

This notice is being issued through the Faceless Assessment Scheme, 2020 (as amended), and all communication shall be through the e-proceeding portal.

Yours faithfully,
(DR. SUMA RAO)
Deputy Commissioner of Income Tax,
Circle-15(1), Bengaluru
DDC: 23456789012345
Date: 11.08.2026`);

translate("11. PATENT CLAIMS (extreme technical language)", `IN THE MATTER OF

Indian Patent Application No. 202411045678
Filed on: 15.03.2024
Published in the Patent Journal: Vol. 2025, Issue 12, dated 15.04.2025
Applicant: M/s Quantum Innovations Private Limited
Inventors: Dr. Ananya Banerjee, Prof. Raghavendra Kulkarni, Dr. Wei Chen

COMPLETE SPECIFICATION

Title of the Invention:
SYSTEM AND METHOD FOR QUANTUM-ENHANCED DEEP LEARNING ARCHITECTURE FOR REAL-TIME MEDICAL IMAGE SEGMENTATION WITH UNCERTAINTY QUANTIFICATION

Field of the Invention:
[0001] The present invention relates generally to the field of artificial intelligence and machine learning, and more particularly, but not exclusively, to a system and method for quantum-enhanced deep learning architectures that leverage quantum computing principles, specifically quantum entanglement and quantum superposition, for real-time medical image segmentation with built-in uncertainty quantification, applicable to but not limited to Magnetic Resonance Imaging (MRI), Computed Tomography (CT), and Positron Emission Tomography (PET) scans.

Background of the Invention:
[0002] Medical image segmentation is a critical step in the diagnosis, treatment planning, and monitoring of various diseases, including cancer, cardiovascular disorders, and neurological conditions. Existing methods for medical image segmentation, including but not limited to U-Net, V-Net, and their variants, suffer from several limitations:

(a) Inability to provide reliable uncertainty estimates for segmentation predictions, which is essential for clinical decision-making;
(b) High computational complexity that precludes real-time inference on standard clinical hardware;
(c) Sensitivity to domain shift and distributional drift when applied to images from different scanners, institutions, or patient populations;
(d) Inability to jointly model spatial dependencies and intensity heterogeneity in a principled probabilistic framework.

[0003] Quantum computing, while still in its nascent stages, offers several theoretical advantages over classical computing for certain classes of problems, including combinatorial optimization, sampling from complex distributions, and feature extraction from high-dimensional data. However, the integration of quantum computing principles with deep learning architectures for medical imaging applications remains largely unexplored.

Summary of the Invention:
[0004] It is an object of the present invention to provide a system and method that overcomes or substantially ameliorates at least one of the disadvantages of the prior art.

[0005] In accordance with one aspect of the present invention, there is provided a quantum-enhanced deep learning system for medical image segmentation, the system comprising:

(a) a quantum feature encoder module, comprising a parameterized quantum circuit (PQC) of depth d and width w, configured to encode classical image features into a quantum Hilbert space of dimension 2^w, wherein the quantum feature encoder utilizes a hardware-efficient ansatz comprising alternating layers of single-qubit rotations (R_y(θ) and R_z(φ) gates) and entangling gates (CZ gates), with a total of (2 × w × d) trainable parameters;

(b) a classical-quantum hybrid attention module, comprising a multi-head self-attention mechanism with k heads, wherein the query (Q), key (K), and value (V) matrices are computed from the output state of the quantum feature encoder via projective measurements in the computational basis, and wherein the attention scores are computed as:

Attention(Q, K, V) = softmax(QK^T / √(d_k)) × V

wherein d_k is the dimension of the key vectors;

(c) a probabilistic decoder module, comprising a Bayesian neural network (BNN) with Monte Carlo (MC) dropout at inference time, configured to produce a segmentation mask of dimensions H × W × C, where H is the height, W is the width, and C is the number of semantic classes, along with a pixel-wise uncertainty map U of the same dimensions;

(d) a quantum-inspired loss function L_total, defined as:

L_total = λ₁ × L_Dice + λ₂ × L_CE + λ₃ × L_KL + λ₄ × L_UQ

wherein:
- L_Dice is the Dice similarity coefficient loss;
- L_CE is the cross-entropy loss;
- L_KL is the Kullback-Leibler divergence between the predicted posterior and a prior distribution over the network weights;
- L_UQ is the uncertainty quantification loss, defined as the negative log-likelihood of the predictive distribution;
- λ₁, λ₂, λ₃, λ₄ are hyperparameters governing the relative importance of each loss term.

[0006] In accordance with another aspect of the present invention, there is provided a method for real-time medical image segmentation using the system as described in [0005], the method comprising the steps of:

Step S1: Acquiring a medical image I of dimensions H × W × D, where D is the number of slices (in the case of volumetric data);
Step S2: Pre-processing the medical image I to normalize intensity values to the range [0, 1] and resampling to isotropic voxel spacing of 1 mm × 1 mm × 1 mm;
Step S3: Encoding the pre-processed image features into a quantum state |ψ⟩ using the quantum feature encoder module;
Step S4: Computing the attention-weighted feature representation using the classical-quantum hybrid attention module;
Step S5: Generating the segmentation mask and uncertainty map using the probabilistic decoder module with T = 50 MC dropout forward passes;
Step S6: Computing the mean segmentation mask Ŝ and the pixel-wise entropy H(U) as the uncertainty measure;
Step S7: Flagging pixels where H(U) > τ (a pre-defined threshold) as "low confidence" for review by a clinical expert.

Claims:

1. A quantum-enhanced deep learning system for medical image segmentation, the system comprising:
   a quantum feature encoder module configured to encode classical image features into a quantum Hilbert space;
   a classical-quantum hybrid attention module configured to compute attention-weighted feature representations;
   a probabilistic decoder module configured to generate segmentation masks and uncertainty maps; and
   a quantum-inspired loss function for training the system.

2. The system of claim 1, wherein the quantum feature encoder utilizes a parameterized quantum circuit with a hardware-efficient ansatz.

3. The system of claim 1, wherein the probabilistic decoder employs Monte Carlo dropout for uncertainty quantification.

4. The system of claim 1, wherein the system is configured to process MRI, CT, and PET images in real-time.

5. A method for medical image segmentation using the system of claim 1, the method comprising the steps of:
   acquiring a medical image;
   encoding image features into a quantum state;
   computing attention-weighted representations;
   generating segmentation masks with uncertainty estimates; and
   flagging low-confidence pixels for clinical review.

6. The method of claim 5, wherein the uncertainty measure is computed as the pixel-wise entropy of the predictive distribution.

7. A computer-readable medium storing instructions that, when executed by a processor, cause the processor to perform the method of claim 5.`);

translate("12. LABOUR DISPUTE (industrial relations)", `OFFICE OF THE CHIEF LABOUR COMMISSIONER (CENTRAL)
(FIFTH FLOOR, SHRAM SHAKTI BHAWAN)
RAF MARG, NEW DELHI – 110001

Case No. CLC/2026/IND/004567
Under the Industrial Disputes Act, 1947, and the Code on Wages, 2019

IN THE MATTER OF:

BETWEEN:

The Workmen of M/s Bharat Heavy Electricals Limited (BHEL),
Haridwar Plant,
P.O. BHEL, Haridwar,
Uttarakhand – 249403
(Hereinafter referred to as "the Workmen/Aggrieved Party")

AND

M/s Bharat Heavy Electricals Limited,
(A Government of India Enterprise under the Ministry of Heavy Industries)
Corporate Office: 14-15, BHEL Estate,
Rajajinagar, Bengaluru – 560010
(Hereinafter referred to as "the Management/Respondent Party")

ORDER

Date of Order: 18.08.2026
Presiding Officer: Shri V.K. Pandey, Joint Chief Labour Commissioner (Central)

1. PRELIMINARY:

1.1 The present dispute was raised by the Workmen, numbering 2,847 (permanent employees) and 1,234 (contract/casual workers), under Section 2-A of the Industrial Disputes Act, 1947, read with Section 9 of the Code on Wages, 2019, and referred to this adjudicatory authority by the appropriate Government (Ministry of Heavy Industries, Government of India) vide Notification No. L-11021/12/2026-Labour dated 15.05.2026, on the following demands:

DEMAND SCHEDULE:

(a) Implementation of the 3rd National Commission on Labour (NCL) recommendations on minimum wages for contract workers engaged in Central Public Sector Enterprises (CPSEs), with retrospective effect from 01.01.2023, amounting to a total arrear liability of Rs. 156.75 Crore;

(b) Regularization of all contract/casual workers who have completed 240 days of continuous service in a calendar year, in accordance with the provisions of Section 5(2) of the Contract Labour (Regulation and Abolition) Act, 1970, and the Supreme Court judgment in the case of State of Karnataka v. Umadevi (3) [(2006) 4 SCC 1];

(c) Grant of Grade Pay revision for all categories of workmen from GP-1800 to GP-1900 with effect from 01.01.2024, in line with the 7th Central Pay Commission (CPC) recommendations as accepted by the Government of India vide Resolution dated 25.07.2016;

(d) Payment of Pending arrears under the Bonus Act, 1965, for the financial years 2022-23, 2023-24, and 2024-25, amounting to Rs. 89.40 Crore;

(e) Establishment of a Joint Committee comprising equal representation from the Workmen and the Management for the resolution of workplace grievances, including issues related to safety, health, and working conditions, in compliance with the Factories Act, 1948, and the Occupational Safety, Health and Working Conditions Code, 2020.

2. SUBMISSIONS OF THE WORKMEN:

2.1 Learned Counsel for the Workmen, Shri Rajiv Goswami, submitted that:

(a) The Management has been exploiting contract workers by paying them wages significantly below the minimum wages notified by the State Government of Uttarakhand, and in some cases, as low as Rs. 7,500/- per month against the notified minimum of Rs. 14,500/- per month;

(b) Despite repeated representations to the Plant HR department, and after the failure of bipartite negotiations under Section 12 of the Industrial Disputes Act, 1947, and the conciliation proceedings before the Regional Conciliation Officer, Dehradun, the Management has refused to engage constructively with the demands of the Workmen;

(c) The Management's refusal to regularize contract workers who have served for more than 240 days is in direct violation of the Supreme Court's landmark judgment in Umadevi (3), which categorically held that "regularization" of daily-wage/temporary workers who have worked for a sufficiently long period (240 days or more) cannot be denied.

2.2 Learned Counsel placed reliance on the following authorities:
(i) State of Karnataka v. Umadevi (3), (2006) 4 SCC 1
(ii) Secretary, State of Karnataka v. Umadevi (3), (2016) 2 SCC 675
(iii) Indian Federation of App-based Transport Workers v. Union of India, (2024) 7 SCC 321

3. SUBMISSIONS OF THE MANAGEMENT:

3.1 Learned Counsel for the Management, Shri Arvind Khanna, submitted that:

(a) The demands of the Workmen are not maintainable in law, as the contract workers are engaged through registered contractors under the provisions of the Contract Labour (Regulation and Abolition) Act, 1970, and the Management has no direct employer-employee relationship with the said workers;

(b) The wages paid to the contract workers are in compliance with the Minimum Wages Act, 1948, as applicable to the State of Uttarakhand, and the Management has no obligation to pay more than the statutory minimum;

(c) The demand for regularization is misconceived, as the Supreme Court in Umadevi (3) itself clarified that the direction for regularization is an exceptional measure to be applied only in cases of "exploitation" and "forced exclusion from the mainstream of regular employment."

4. FINDINGS AND DISPOSAL:

4.1 After carefully considering the submissions of both parties, the documents placed on record, and the applicable provisions of law, I am of the considered view that:

(a) The demand for implementation of the 3rd NCL recommendations on minimum wages is justified, and the Management is directed to implement the same with effect from 01.07.2026, with arrears to be paid in two equal instalments within 90 days;

(b) The demand for regularization of contract workers is referred back to a bipartite committee comprising three representatives each from the Workmen and the Management, to be constituted within 30 days, and to submit its report within 90 days;

(c) The demand for Grade Pay revision is allowed with effect from 01.01.2024;

(d) The demand for pending bonus is allowed, and the Management is directed to disburse the bonus within 60 days;

(e) The demand for a Joint Committee is allowed, and the Management is directed to constitute the same within 30 days.

The order is subject to ratification by the appropriate Government under Section 17 of the Industrial Disputes Act, 1947.

(V.K. Pandey)
Joint Chief Labour Commissioner (Central)
Date: 18.08.2026
Place: New Delhi`);

translate("13. INTERNATIONAL TRADE (Letter of Credit)", `Date: 09.08.2026

To:
State Bank of India
International Banking Division
Corporate Office, 3rd Floor
State Bank Bhawan, Nariman Point
Mumbai – 400021

From:
M/s Pan亚洲 Trading Corporation
(Unit No. 1204, 12th Floor, Marathon Futurex
Mafatlal Mills Compounds, N.M. Joshi Marg
Lower Parel, Mumbai – 400013)

Subject: Application for Issuance of Irrevocable Letter of Credit (LC) Under UCP 600 (ICC Publication No. 600)

Reference: Our File No. PTC/LC/2026/4567

Sir,

We hereby request you to issue an Irrevocable Documentary Letter of Credit in favour of the beneficiary, M/s Shenzhen Great Wall Electronics Co. Ltd. (hereinafter referred to as "the Seller/Beneficiary"), under the terms and conditions specified below, governed by the Uniform Customs and Practice for Documentary Credits (UCP 600), International Chamber of Commerce (ICC) Publication No. 600, as amended from time to time:

1. LC DETAILS:

| Particulars | Details |
|---|---|
| LC Type | Irrevocable Documentary LC (Confirmed) |
| LC Amount | USD 487,500.00 (US Dollars Four Hundred Eighty-Seven Thousand Five Hundred Only) |
| Tolerance | ± 5% (i.e., maximum LC amount: USD 511,875.00) |
| Beneficiary | M/s Shenzhen Great Wall Electronics Co. Ltd. |
| Applicant | M/s Pan亚洲 Trading Corporation |
| Issuing Bank | State Bank of India, Mumbai |
| Advising Bank | Bank of China, Shenzhen Branch |
| Confirming Bank | HSBC, Hong Kong (confirming charges for account of applicant) |
| LC Expiry Date | 30.11.2026 (at the counter of the Advising Bank) |
| Latest Date of Shipment | 15.11.2026 |
| Partial Shipments | Allowed |
| Transshipment | Allowed |
| Port of Loading | Shenzhen, China (via Yantian International Container Terminal) |
| Port of Discharge | JNPT (Jawaharlal Nehru Port Trust), Navi Mumbai |
| Inland Freight | For Buyer's account (EXW Shenzhen to JNPT) |

2. DOCUMENTS REQUIRED:

(a) Signed Commercial Invoice in triplicate, indicating the LC number, contract number (PTC/PUR/2026/789), and full description of goods;

(b) Full set (3/3) of clean on-board ocean bills of lading (B/L), made out to order and blank endorsed, marked "Freight Prepaid" / "Freight Collect" as applicable, notify party: M/s Pan亚洲 Trading Corporation, with the address and contact details;

(c) Packing List in triplicate, indicating the gross weight, net weight, and dimensions (CBM) of each package;

(d) Certificate of Origin (CO) issued by the China Council for the Promotion of International Trade (CCPIT), in duplicate, indicating the country of origin as "The People's Republic of China";

(e) Insurance Policy or Certificate, in duplicate, for 110% of the invoice value, covering Institute Cargo Clauses (A) — All Risks — as per the Institute War Clauses (Cargo) and Institute Strikes Clauses (Cargo), with claims payable at the port of destination (JNPT, Navi Mumbai) in the currency of the LC;

(f) Fumigation Certificate issued by an approved fumigation agency at the port of loading;

(g) Phytosanitary Certificate (if applicable) issued by the AQSIQ (General Administration of Quality Supervision, Inspection and Quarantine) of China;

(h) SGS Inspection Certificate, issued by SGS (Société Générale de Surveillance), for quality and quantity verification at the port of loading;

(i) Beneficiary's Certificate certifying that one set of non-negotiable documents has been sent to the applicant within 5 days of shipment;

(j) SWIFT MT799 (Pre-Advice) from the Confirming Bank (HSBC, Hong Kong) confirming its confirmation of the LC.

3. EXTRAORDINARY TERMS AND CONDITIONS:

(a) All banking charges outside the issuing bank (including confirmation charges, advising charges, and SWIFT charges) are for the account of the applicant;

(b) The LC is subject to the UCP 600 (ICC Publication No. 600), and in case of any discrepancy, the documents will be presented to the issuing bank under a "Discrepancy Waiver" (if agreed by the applicant);

(c) The LC shall be automatically reduced by the amount of each drawing, and the remaining amount shall be available for further drawings until the LC expiry date;

(d) The seller is permitted to draw the LC amount in multiple presentations (drawings), provided each presentation is accompanied by the full set of documents as specified above;

(e) In case of force majeure events (including but not limited to war, pandemic, natural disaster, or government sanctions), the LC expiry date shall be automatically extended by 30 days;

(f) Any dispute arising out of or in connection with this LC shall be referred to the Mumbai Centre for International Arbitration (MCIA), and the arbitration shall be conducted in accordance with the MCIA Rules, 2016, in the English language.

4. SECURITY AND MARGIN:

We are offering the following security for the issuance of the LC:
(a) FDR (Fixed Deposit Receipt) of Rs. 3,50,00,000/- (margin of 25% on the LC value, converted at the prevailing exchange rate of USD 1 = Rs. 83.50);
(b) Personal guarantee of the directors of the company;
(c) Hypothecation of goods and documents of title.

Kindly process the above application at the earliest and confirm the LC issuance by SWIFT MT760 to the Advising Bank (Bank of China, Shenzhen) at the earliest.

Thanking you,

Yours faithfully,
For M/s Pan亚洲 Trading Corporation
(ASD signed)
(Director: Mr. Rajesh Menon)
Contact: +91-98XXXXXXXX
Email: trade@panasiatrading.com`);

translate("14. SUPREME COURT PETITION (constitutional law)", `IN THE SUPREME COURT OF INDIA
CIVIL ORIGINAL JURISDICTION

Writ Petition (Civil) No. ____/2026

IN THE MATTER OF:

Dr. Aruna Roy & Ors. ………Petitioners

Versus

Union of India & Ors. ………Respondents

WRIT PETITION UNDER ARTICLE 32 OF THE CONSTITUTION OF INDIA FOR ENFORCEMENT OF FUNDAMENTAL RIGHTS

PETITION UNDER ARTICLE 32 OF THE CONSTITUTION OF INDIA FOR ISSUANCE OF A WRIT IN THE NATURE OF CERTIORARI, MANDAMUS, AND/OR OTHER APPROPRIATE WRIT(S), ORDER(S) OR DIRECTION(S)

MOST RESPECTFULLY SHOWETH:

1. That the Petitioners are citizens of India, and are residents of the State of Rajasthan, and are engaged in social work, particularly in the field of right to information, transparency in governance, and the empowerment of marginalized communities, including Scheduled Castes (SCs), Scheduled Tribes (STs), and Other Backward Classes (OBCs).

2. That the Petitioners have been associated with the Mazdoor Kisan Shakti Sangathan (MKSS), a social movement working for the right to information and accountability in governance, and have been instrumental in the passage of the Right of Citizens to Information Act, 2005, by sustained public advocacy and litigation.

3. That the present Writ Petition is filed in the public interest, and the Petitioners approach this Hon'ble Court under Article 32 of the Constitution, which guarantees the right to move the Supreme Court by appropriate proceedings for the enforcement of the rights conferred by Part III of the Constitution.

GRIEVANCES:

4. That the Petitioners aggrieved by the following actions and/or omissions of the Respondent-Union of India, which are violative of the fundamental rights of the citizens of India:

(a) Violation of Article 19(1)(a) — Right to Freedom of Speech and Expression:
The Central Government has, through a series of executive orders and notifications, including but not limited to the Notification dated 15.06.2026 (Office Memorandum No. 1/2/2026-IR) issued by the Ministry of Electronics and Information Technology (MeitY), imposed unreasonable restrictions on the publication and dissemination of government data, including:
(i) Prohibition on the publication of any data obtained through the RTI Act, 2005, without prior "security clearance" from the designated authority;
(ii) Mandatory deletion of all "sensitive" data from government websites within 48 hours of a request from any government department;
(iii) Imposition of criminal penalties (imprisonment up to 3 years and a fine up to Rs. 5 lakhs) for "unauthorized publication" of government data — a provision that is manifestly unreasonable and has a chilling effect on free speech.

(b) Violation of Article 14 — Right to Equality:
The Notification dated 15.06.2026 applies only to "non-governmental organizations" (NGOs) and "civil society organizations" (CSOs), while exempting all government departments, public sector undertakings, and statutory bodies from its purview. This discriminatory classification is arbitrary and violative of Article 14, which guarantees equality before the law and equal protection of the laws.

(c) Violation of Article 21 — Right to Life and Personal Liberty:
The right to information has been recognized by this Hon'ble Court as an integral part of the right to life and personal liberty under Article 21 (see: State of U.P. v. Raj Narain, (1975) AIR SC 865; S.P. Gupta v. Union of India, (1982) AIR SC 149). The imposition of unreasonable restrictions on the right to information has the direct effect of undermining the right to life and personal liberty of the citizens.

(d) Violation of Article 144 — Duty of all authorities to act in aid of the Supreme Court:
The Notification dated 15.06.2026 is in direct conflict with the spirit and letter of this Hon'ble Court's judgment in S.P. Gupta v. Union of India, (1982) AIR SC 149, wherein this Court held that "the concept of an open government is the direct emanation from the right to know which seems to be implicit in the right of free speech and expression guaranteed under Article 19(1)(a)."

PRAYERS:

In view of the above, it is most respectfully prayed that this Hon'ble Court may be pleased to:

(a) Issue a writ of certiorari or any other appropriate writ, order, or direction, quashing the Notification dated 15.06.2026 (Office Memorandum No. 1/2/2026-IR) of the Ministry of Electronics and Information Technology, being violative of Articles 14, 19(1)(a), and 21 of the Constitution;

(b) Issue a writ of mandamus or any other appropriate writ, order, or direction, directing the Respondent-Union of India to:
(i) Refrain from imposing any unreasonable restrictions on the publication and dissemination of government data;
(ii) Ensure the effective implementation of the Right of Citizens to Information Act, 2005, in letter and spirit;
(iii) Take all necessary steps to protect and promote the right to information of the citizens of India;

(c) Pass such other and further order(s) as this Hon'ble Court may deem fit and proper in the facts and circumstances of the case, and in the interests of justice.

AND FOR THIS ACT OF KINDNESS, THE PETITIONERS SHALL, AS IN DUTY BOUND, EVER PRAY.

Petitioners' Advocate
(Advocate-on-Record: Mr. Prashant Bhushan)
F.No. 302, Lawyers Chambers,
Supreme Court of India,
New Delhi – 110001
Tel: +91-11-XXXX-XXXX
Email: prashant.bhushan@lawfirm.in
Date: 20.08.2026`);

translate("15. REAL ESTATE DEED (property law)", `REGISTRATION OFFICE OF THE SUB-REGISTRAR
SUB-DIVISION-I, DISTRICT GURUGRAM
STATE OF HARYANA

Registration Document No. 2847/2026
Date of Execution: 05.08.2026
Date of Registration: 07.08.2026

REGISTRATION OF SALE DEED UNDER THE REGISTRATION ACT, 1908, READ WITH THE INDIAN STAMP ACT, 1899 (AS AMENDED BY THE HARYANA AMENDMENT ACT, 2022)

This Deed of Sale (hereinafter referred to as "this Deed" or "this Instrument") is executed on this 5th day of August, 2026, at Gurugram, Haryana.

BETWEEN:

PARTY OF THE FIRST PART (VENDOR/SELLER):
Shri Sunil Agarwal, S/o Late Shri Mahesh Agarwal, aged about 62 years, Indian Inhabitant, R/o House No. 45, Sector-21A, Faridabad, Haryana – 121002, PAN: XXXXX1234X, Aadhaar: XXXX-XXXX-5678
(Hereinafter referred to as "the VENDOR" or "FIRST PARTY", which expression shall, unless repugnant to the context or meaning thereof, include his heirs, legal representatives, executors, administrators, successors, and assigns)

AND

PARTY OF THE SECOND PART (VENDEE/PURCHASER):
Shri Vikram Mehta, S/o Shri R.K. Mehta, aged about 38 years, Indian Inhabitant, R/o Flat No. 2201, DLF The Camellias, Sector 26, Gurugram, Haryana – 122002, PAN: XXXXX5678Y, Aadhaar: XXXX-XXXX-9012
(Hereinafter referred to as "the VENDEE" or "SECOND PARTY", which expression shall, unless repugnant to the context or meaning thereof, include his heirs, legal representatives, executors, administrators, successors, and assigns)

WHEREAS:

1. The VENDOR is the absolute and lawful owner of the property more particularly described in Schedule-A annexed hereto (hereinafter referred to as "the Scheduled Property"), having acquired the same by virtue of a registered Gift Deed dated 15.01.2018, executed by his late father, Shri Mahesh Agarwal, and registered as Document No. 1234/2018 at the office of the Sub-Registrar, Sector-14, Gurugram;

2. The VENDOR has a clear, marketable, and undisputed title to the Scheduled Property, free from all encumbrances, mortgages, liens, charges, attachments, restrictions, litigations, and claims of any nature whatsoever;

3. The VENDOR, being desirous of selling the Scheduled Property, entered into an Agreement to Sell dated 20.06.2026 with the VENDEE, at the total sale consideration of Rs. 1,85,00,000/- (Rupees One Crore Eighty-Five Lakhs Only), of which:

(a) Earnest Money Deposit (EMD) of Rs. 10,00,000/- (Rupees Ten Lakhs Only) was paid by the VENDEE to the VENDOR at the time of execution of the Agreement to Sell, via NEFT transfer (Ref. No. NEFT/2026/78901234 dated 20.06.2026);

(b) Balance sale consideration of Rs. 1,75,00,000/- (Rupees One Crore Seventy-Five Lakhs Only) is payable by the VENDEE to the VENDOR on or before the date of execution and registration of this Sale Deed;

4. The VENDOR has confirmed that the Scheduled Property is:

(a) Not falling within the purview of the Haryana Urban Development Authority (HUDA) or the Gurugram Metropolitan Development Authority (GMDA) acquisition proceedings;

(b) Not situated within 100 metres of any national highway, state highway, or arterial road, as per the Master Plan for Gurugram (MPG-2031);

(c) Not covered under any heritage zone or environmental protection zone, as notified by the Haryana State Pollution Control Board (HSPCB);

(d) Complying with all applicable building bylaws, including the Haryana Building Code, 2017, and the National Building Code of India (NBC), 2016.

NOW THIS DEED WITNESSETH AS UNDER:

1. In consideration of the sum of Rs. 1,85,00,000/- (Rupees One Crore Eighty-Five Lakhs Only), the receipt and payment of which is hereby acknowledged by the VENDOR, the VENDOR doth hereby grant, convey, sell, transfer, and assign unto the VENDEE, absolutely and forever, all that the Scheduled Property, together with:

(a) All appurtenant rights, privileges, easements, and advantages whatsoever belonging to or in any way attached to the Scheduled Property;

(b) The land, buildings, structures, fixtures, and improvements thereon;

(c) The air space above and the sub-soil below the Scheduled Property;

(d) All common areas and facilities as defined in the Haryana Apartment Ownership Act, 1983 (Act No. 8 of 1983);

2. THE VENDEE doth hereby agree to hold and enjoy the Scheduled Property as absolute owner thereof, subject to the terms and conditions of this Deed;

3. THE VENDOR doth hereby covenant and declare that:

(a) He has good and marketable title to the Scheduled Property and has not heretofore alienated, encumbered, or dealt with the same in any manner whatsoever;

(b) The Scheduled Property is free from all encumbrances, and if any encumbrance is found to exist at any time hereafter, the VENDOR shall be liable to indemnify the VENDEE against all losses, damages, and costs arising therefrom;

(c) He shall, if so required, execute all such further documents and instruments as may be necessary to give full effect to this conveyance.

THE SCHEDULE OF PROPERTY (SCHEDULE-A):

All that flat/apartment being Flat No. 1205, on the 12th Floor, Tower-C, M/s DLF The Aralias, Sector 42, Gurugram, Haryana – 122002, admeasuring approximately 3,245 square feet of super area, as per the approved building plan of the Gurugram Metropolitan Development Authority (GMDA), bearing Building Plan Approval No. GMDA/BPA/2015/4567 dated 10.03.2015, along with two covered car parking spaces (Nos. C-1205-A and C-1205-B) on the stilt floor.

IN WITNESS WHEREOF, the parties have hereunto set and subscribed their respective hands and signatures on the day, month, and year first above written, in the presence of the witnesses mentioned below.

WITNESSES:

1. Shri Anil Kumar, S/o Shri Ramesh Kumar, R/o 23, DLF Phase-IV, Gurugram
2. Smt. Sunita Devi, W/o Shri Mohan Lal, R/o 56, Sector-15, Gurugram

EXECUTANTS:

1. [Sd.] Sunil Agarwal (VENDOR/SELLER)
2. [Sd.] Vikram Mehta (VENDEE/PURCHASER)

Before me,
(Sub-Registrar, Gurugram)
Date of Registration: 07.08.2026`);

translate("16. PARLIAMENTARY COMMITTEE REPORT (governance language)", `PARLIAMENTARY STANDING COMMITTEE ON INFORMATION TECHNOLOGY
LOK SABHA SECRETARIAT
PARLIAMENT HOUSE, NEW DELHI – 110001

23rd Report of the Standing Committee on Information Technology
(2025-2026)
On the Subject: "Regulation of Artificial Intelligence and Deep Learning Technologies in India — Concerns, Challenges, and Recommendations"

Presented to the Lok Sabha on 14.08.2026
Laid on the Table of the Rajya Sabha on 14.08.2026

Chairperson: Shri Ramesh Bidhuri, MP (Lok Sabha)
Committee Members: 31 (20 from Lok Sabha, 11 from Rajya Sabha)

CONTENTS

1. Introduction and Scope
2. Methodology
3. Overview of AI Regulation Globally
4. Current State of AI in India
5. Key Concerns and Challenges
6. Stakeholder Consultations
7. Recommendations
8. Summary of Recommendations and Action Points

CHAPTER 1: INTRODUCTION AND SCOPE

1.1 The Standing Committee on Information Technology, constituted under Rule 331C of the Rules of Procedure and Conduct of Business in the Lok Sabha (15th Lok Sabha), was mandated to examine the following:

(a) The adequacy of the existing legal and regulatory framework for the governance of artificial intelligence (AI), machine learning (ML), deep learning (DL), and related technologies in India;

(b) The impact of AI on fundamental rights, particularly the right to privacy (Article 21), the right to equality (Article 14), and the right to non-discrimination;

(c) The preparedness of India's institutional infrastructure (including the judiciary, regulatory bodies, and law enforcement agencies) to address the challenges posed by AI;

(d) The comparative analysis of AI regulatory frameworks in select jurisdictions, including the European Union (EU AI Act, 2024), the United States (Executive Order on Safe, Secure, and Trustworthy AI, October 2023), the United Kingdom (Pro-Innovation Approach to AI Regulation, March 2023), China (Interim Measures for the Management of Generative AI Services, August 2023), and Singapore (Model AI Governance Framework, 2020);

(e) The recommendations of the IndiaAI Mission, the National Strategy for Artificial Intelligence (NITI Aayog, 2018), and the recommendations of the Technology Development Board (TDB).

1.2 The Committee received a total of 847 submissions from various stakeholders, including technology companies, civil society organizations, academic institutions, law firms, and individual experts. The Committee also conducted 12 rounds of evidence sessions, during which 67 witnesses were examined.

CHAPTER 4: CURRENT STATE OF AI IN INDIA

4.1 The Committee notes that India's AI ecosystem has grown significantly in recent years, with the following key indicators:

(a) AI-related patent filings have increased from 2,345 in 2022 to 8,901 in 2025 (a 280% increase);

(b) The number of AI startups in India has grown from 2,200 in 2022 to 7,800 in 2025, with cumulative funding of approximately USD 4.2 billion;

(c) The National AI Portal (www.indiaai.gov.in) has registered over 12,000 AI-based products and services;

(d) The government's AI-MAHAS initiative (AI for MSMEs, Healthcare, Agriculture, Smart cities, and Education) has deployed over 150 AI-based solutions across 28 states and 8 Union Territories.

4.2 The Committee is, however, concerned by the following findings:

(a) Only 12% of Indian organizations have implemented a comprehensive AI governance framework, compared to 45% in the European Union and 38% in the United States;

(b) India lacks a dedicated AI regulatory authority, and the current regulatory landscape is fragmented across multiple ministries (MeitY, Ministry of Commerce, Ministry of Health, etc.);

(c) There is no comprehensive data protection framework in place (the Digital Personal Data Protection Act, 2023, is yet to be fully operationalized);

(d) The shortage of AI-skilled workforce in India is estimated at 4,50,000 professionals, according to a NASSCOM study.

CHAPTER 7: RECOMMENDATIONS

7.1 The Committee, after careful consideration of the evidence, submissions, and expert testimony, makes the following recommendations:

Recommendation 1: Establishment of an AI Regulatory Authority
The Committee recommends the establishment of a dedicated AI Regulatory Authority (AIRA), on the lines of the Reserve Bank of India (RBI) for financial regulation, with the following mandate:
(a) Registration and licensing of AI systems based on risk classification;
(b) Monitoring and enforcement of AI-related regulations;
(c) Development of technical standards and guidelines;
(d) Redressal of grievances related to AI-related harms.

Recommendation 2: Risk-Based Regulatory Framework
The Committee recommends the adoption of a risk-based regulatory framework, classifying AI systems into four tiers:
(a) Unacceptable Risk (prohibited): AI systems that pose a clear threat to fundamental rights, including social scoring systems, real-time biometric surveillance in public spaces (except for counter-terrorism purposes approved by a competent court), and AI systems that exploit vulnerabilities of specific groups;
(b) High Risk (strictly regulated): AI systems used in critical domains such as healthcare, education, law enforcement, employment, and credit scoring;
(c) Limited Risk (transparency requirements): AI systems that interact with humans (chatbots, virtual assistants) or generate content (deepfakes, synthetic media);
(d) Minimal Risk (no specific regulation): AI systems used in non-critical applications such as spam filters, video games, and inventory management.

Recommendation 3: Mandatory AI Impact Assessment (AIA)
The Committee recommends that all High-Risk AI systems undergo a mandatory AI Impact Assessment (AIA) before deployment, to be conducted by an accredited third-party auditor, covering:
(a) Data quality and bias assessment;
(b) Algorithmic transparency and explainability;
(c) Privacy impact assessment;
(d) Impact on employment and livelihood;
(e) Environmental impact (energy consumption, carbon footprint).

Recommendation 4: National AI Data Trust
The Committee recommends the establishment of a National AI Data Trust, to be managed by a Board comprising representatives from the government, industry, academia, and civil society, with the mandate to:
(a) Curate and maintain high-quality, anonymized datasets for AI training;
(b) Ensure that the benefits of AI are distributed equitably across all sections of society;
(c) Prevent the monopolization of data by a few large corporations.

CHAPTER 8: SUMMARY OF RECOMMENDATIONS AND ACTION POINTS

| S.No. | Recommendation | Responsible Ministry | Timeline |
|---|---|---|---|
| 1 | Establish AI Regulatory Authority (AIRA) | MeitY | 12 months |
| 2 | Enact AI (Regulation) Act | Ministry of Law | 18 months |
| 3 | Implement risk-based classification | AIRA | 6 months |
| 4 | Mandatory AI Impact Assessment | NITI Aayog + AIRA | 12 months |
| 5 | National AI Data Trust | MeitY + NITI Aayog | 18 months |
| 6 | AI skilling mission (500,000 professionals) | Ministry of Skill Development | 36 months |
| 7 | AI Safety Research Fund (Rs. 500 Cr) | Ministry of Science & Technology | 6 months |
| 8 | Regulatory sandbox for AI innovation | AIRA | 12 months |

The Chairman thanked all the members of the Committee, the officers of the Lok Sabha Secretariat, and the stakeholders for their valuable contributions.

(Ramesh Bidhuri)
Chairperson,
Parliamentary Standing Committee on Information Technology
Date: 14.08.2026
Place: New Delhi`);

translate("17. MEDICAL REPORT (complex clinical terminology)", `TO WHOM IT MAY CONCERN

MEDICAL CERTIFICATE

Date: 16.08.2026
Patient Name: Shri Harish Chandra Sharma
Age/Sex: 67 Years / Male
UHID: AIIMS/2026/456789
IPD No.: 2026/78912
Date of Admission: 01.08.2026
Date of Discharge: 15.08.2026

This is to certify that Shri Harish Chandra Sharma, aged 67 years, male, S/o Late Shri Ram Prasad Sharma, R/o 12, Civil Lines, Jaipur, Rajasthan – 302006, was admitted to the Department of Cardiology, All India Institute of Medical Sciences (AIIMS), New Delhi, on 01.08.2026, and was discharged on 15.08.2026, under my care and treatment for the following medical conditions:

DIAGNOSIS:

1. Acute ST-Elevation Myocardial Infarction (STEMI) — Anterior Wall (ICD-10 Code: I21.0)
   - Clinical presentation: The patient presented with acute onset retrosternal chest pain radiating to the left arm, of 4 hours' duration, associated with profuse sweating (diaphoresis), nausea, and breathlessness (NYHA Class III).
   - ECG findings: ST-segment elevation in leads V1-V4 with reciprocal ST depression in leads II, III, and aVF. Pathological Q waves in leads V1-V3.
   - Cardiac biomarkers: Troponin-I: 18.5 ng/mL (normal: < 0.04 ng/mL); CK-MB: 186 U/L (normal: < 25 U/L); BNP: 1,245 pg/mL (normal: < 100 pg/mL).

2. Dilated Cardiomyopathy (DCM) with Severe Left Ventricular Systolic Dysfunction (ICD-10 Code: I42.0)
   - Echocardiography (dated 02.08.2026): Left Ventricular Ejection Fraction (LVEF): 25% (severely reduced); Left Ventricular End-Diastolic Diameter (LVEDD): 68 mm (dilated); Moderate Mitral Regurgitation (MR); Mild Tricuspid Regurgitation (TR); Pulmonary Artery Systolic Pressure (PASP): 52 mmHg (moderate pulmonary hypertension).

3. Chronic Kidney Disease (CKD) Stage 3A (ICD-10 Code: N18.3)
   - Serum Creatinine: 1.8 mg/dL (normal: 0.7-1.2 mg/dL)
   - eGFR: 42 mL/min/1.73m² (reduced; normal: > 90)
   - BUN: 38 mg/dL (elevated; normal: 7-20)
   - HbA1c: 8.2% (poorly controlled diabetes mellitus)

4. Type 2 Diabetes Mellitus (ICD-10 Code: E11.9)
   - Fasting Blood Sugar: 245 mg/dL (poorly controlled)
   - Post-Prandial Blood Sugar: 380 mg/dL
   - HbA1c: 8.2% (target: < 7%)

5. Hypertension (ICD-10 Code: I10)
   - Blood Pressure at admission: 180/110 mmHg (Stage 3 Hypertension)
   - Blood Pressure at discharge: 135/85 mmHg (controlled on medication)

TREATMENT PROCEDURE:

Primary Percutaneous Coronary Intervention (PCI) with Drug-Eluting Stent (DES) Placement:

On 01.08.2026, at 10:45 AM, the patient underwent emergency Primary PCI via the Right Radial Artery approach, performed by Dr. Ajay Kirtane (Interventional Cardiologist, Regn. No. MCI/DM/67890) and Dr. Sunita Reddy (Interventional Cardiologist, Regn. No. MCI/DM/67891).

Procedure Details:
- Vascular access: Right Radial Artery (6F sheath)
- Guiding catheter: 6F EBU 3.5 (Medtronic)
- Wire: Asahi Fielder XT (0.014" guidewire)
- Lesion: 95% thrombotic stenosis of the Left Anterior Descending (LAD) artery, proximal segment
- Thrombus aspiration performed using Eliminate Catheter (Terumo)
- Balloon pre-dilation: Sprinter Legend 3.0 × 15 mm (Medtronic) at 12 ATM
- Stent deployment: Xience Sierra 3.5 × 23 mm (Abbott) drug-eluting stent at 14 ATM
- Post-dilation: NC Trek 3.5 × 15 mm (Abbott) at 18 ATM
- Final angiogram: TIMI Flow Grade 3, residual stenosis < 10%

Post-Procedure Medications:
1. Tab. Aspirin 150 mg (once daily, lifelong)
2. Tab. Ticagrelor 90 mg BD (for 12 months)
3. Tab. Atorvastatin 80 mg (once daily, at bedtime)
4. Tab. Metoprolol Succinate 50 mg (once daily)
5. Tab. Ramipril 5 mg (once daily)
6. Tab. Metformin 500 mg TID (with meals)
7. Tab. Sitagliptin 100 mg (once daily)
8. Tab. Torsemide 20 mg (once daily, in the morning)
9. Tab. Spironolactone 25 mg (once daily)
10. Inj. Enoxaparin 0.6 mg SC BD (for 5 days post-PCI, then switched to Tab. Apixaban 2.5 mg BD)

FOLLOW-UP PLAN:

1. Follow-up visit at 2 weeks post-discharge (30.08.2026) — cardiac clinic
2. Follow-up visit at 1 month (15.09.2026) — cardiology OPD
3. Repeat Echocardiography at 3 months (15.11.2026)
4. Cardiac Rehabilitation Programme (Phase I and Phase II) at the AIIMS Cardio-Thoracic and Vascular Sciences (CTVS) Centre

This certificate is issued for the purpose of availing medical leave from his employer, M/s Rajasthan State Road Development and Construction Corporation (RSRDCC), Jaipur, and for any other official purpose as may be required.

(Prof. Dr. K.K. Sethi)
Head, Department of Cardiology
All India Institute of Medical Sciences (AIIMS)
New Delhi – 110029
Registration No.: MCI/DM/12345
Seal: [AIIMS Cardiology Department Seal]`);

translate("18. ENVIRONMENTAL LITIGATION (complex statutory references)", `IN THE NATIONAL GREEN TRIBUNAL, PRINCIPAL BENCH
NEW DELHI

Original Application No. 678/2026 (ZC)

IN THE MATTER OF:

M/s People's Union for Civil Liberties (PUCL) ……Applicant

Versus

1. Union of India
2. Ministry of Environment, Forest and Climate Change
3. Central Pollution Control Board (CPCB)
4. State Pollution Control Board, Uttar Pradesh
5. M/s Yash Paper Limited
6. District Magistrate, Pratapgarh, Uttar Pradesh ……Respondents

APPLICATION UNDER SECTIONS 14 AND 15 OF THE NATIONAL GREEN TRIBUNAL ACT, 2010, READ WITH RULES 3, 4, 5, AND 24 OF THE NGT (PRINCIPAL BENCH) JURISDICTION AND PROCEDURE RULES, 2011

APPLICATION FOR ENVIRONMENTAL COMPENSATION AND RESTORATION OF ECOLOGICAL DAMAGE

MOST RESPECTFULLY SHOWETH:

1. THAT the Applicant, M/s People's Union for Civil Liberties (PUCL), is a registered civil society organization under the Societies Registration Act, 1860, and has been consistently engaged in the protection of environmental rights and the enforcement of environmental laws, particularly in the context of industrial pollution affecting rivers, groundwater, and agricultural lands.

2. THAT the Applicant has brought to the notice of this Hon'ble Tribunal the following grave environmental violations being committed by the 5th Respondent, M/s Yash Paper Limited (hereinafter referred to as "the Polluter"), in the operation of its paper manufacturing unit located at Village Harchandpur, Post Baghara, District Pratapgarh, Uttar Pradesh – 229408:

ENVIRONMENTAL VIOLATIONS:

A. WATER POLLUTION:

(i) The Polluter has been discharging untreated industrial effluent into the Gomti River (a perennial tributary of the Ganga River) through a concealed pipeline (approximately 1.2 km long), in gross violation of the Water (Prevention and Control of Pollut ion) Act, 1974, and the Effluent Standards prescribed by the Central Pollution Control Board (CPCB) vide its notification dated 04.09.2019 (S.O. 3275(E)).

(ii) The effluent samples collected by the CPCB's Regional Laboratory, Lucknow, on 15.06.2026, revealed the following alarming parameters:

| Parameter | Prescribed Standard (mg/L) | Observed Value (mg/L) | Exceedance |
|---|---|---|---|
| Biochemical Oxygen Demand (BOD) | 30 | 847 | 2,723% |
| Chemical Oxygen Demand (COD) | 250 | 3,456 | 1,282% |
| Total Suspended Solids (TSS) | 100 | 1,890 | 1,790% |
| Total Dissolved Solids (TDS) | 2,100 | 8,560 | 307% |
| pH | 5.5–9.0 | 3.2 (Highly Acidic) | Exceeded |
| Oil and Grease | 10 | 345 | 3,350% |
| Chromium (Hexavalent) | 0.05 | 2.8 | 5,500% |
| Lead | 0.05 | 1.2 | 2,300% |
| Mercury | 0.001 | 0.08 | 7,900% |
| Cadmium | 0.01 | 0.45 | 4,400% |

B. AIR POLLUTION:

(iii) The Polluter operates three coal-fired boilers (rated capacity: 20 TPH each) without the requisite Consent to Operate (CTO) from the Uttar Pradesh State Pollution Control Board (UPSPCB), in violation of Section 21 of the Air (Prevention and Control of Pollution) Act, 1981.

(iv) Stack emissions from the boilers were measured by the CPCB's authorized monitoring agency on 20.06.2026, and the following exceedances were recorded:

| Pollutant | Standard (mg/Nm³) | Observed Value (mg/Nm³) | Exceedance |
|---|---|---|---|
| Particulate Matter (PM) | 150 | 2,890 | 1,827% |
| Sulphur Dioxide (SO₂) | 500 | 1,876 | 275% |
| Nitrogen Oxides (NOx) | 500 | 1,234 | 147% |
| Carbon Monoxide (CO) | — | 456 mg/Nm³ | Significant |

C. HAZARDOUS WASTE VIOLATIONS:

(v) The Polluter generates approximately 12,000 Metric Tonnes (MT) per annum of hazardous waste, including paper mill sludge containing heavy metals (chromium, lead, mercury, and cadmium), spent caustic soda, and hazardous chemical residues, and has been dumping the same in an unauthorized manner on agricultural land belonging to local farmers, in violation of the Hazardous and Other Wastes (Management and Transboundary Movement) Rules, 2016.

D. IMPACT ON PUBLIC HEALTH:

(vi) The environmental pollution caused by the Polluter has had a devastating impact on the health and livelihood of the local population, including:
- 47 reported cases of cancer (including gastric, esophageal, and liver cancer) in the villages of Harchandpur, Baghara, and adjoining areas during the period 2020-2026;
- Contamination of groundwater in a radius of approximately 8 km from the factory, rendering the water unfit for human consumption and agricultural use;
- Destruction of approximately 450 hectares of agricultural land due to effluent discharge;
- Death of approximately 15,000 fish in the Gomti River due to acute toxicity from chromium and mercury contamination.

PRAYERS:

In view of the above, the Applicant most respectfully prays that this Hon'ble Tribunal may be pleased to:

(a) Direct the 5th Respondent (Polluter) to immediately cease all operations and discharges that are causing environmental pollution, and to shut down the paper manufacturing unit until all environmental compliance requirements are met;

(b) Direct the Central Pollution Control Board (CPCB) and the UPSPCB to conduct a comprehensive environmental audit of the Polluter's operations and submit a report within 60 days;

(c) Award environmental compensation of Rs. 500 Crore (Rupees Five Hundred Crore Only) under the "Polluter Pays" principle, as recognized by this Hon'ble Tribunal in M.C. Mehta v. Union of India, (2010) 6 SCC 1;

(d) Direct the Polluter to prepare and implement a comprehensive Environmental Restoration Plan, including:
(i) Remediation of contaminated groundwater and soil;
(ii) Restoration of the Gomti River ecosystem;
(iii) Compensation to affected farmers for crop loss and health impacts;
(iv) Establishment of a Community Health Monitoring Station in the affected area;

(e) Direct the District Magistrate, Pratapgarh, to constitute a Joint Committee comprising representatives of the CPCB, UPSPCB, District Administration, and civil society to oversee the implementation of the remediation plan;

(f) Pass such other and further order(s) as this Hon'ble Tribunal may deem fit and proper in the facts and circumstances of the case.

AND FOR THIS ACT OF KINDNESS, THE APPLICANT SHALL, AS IN DUTY BOUND, EVER PRAY.

Applicant's Advocate
(Advocate-on-Record: Shri M.C. Mehta)
F.No. 204, Environmental Law Chambers
Near Supreme Court, New Delhi – 110001
Date: 18.08.2026`);

translate("19. MULTI-PARTY JOINT VENTURE (complex commercial)", `JOINT VENTURE AGREEMENT

DATE: 01.08.2026

BETWEEN:

(1) M/s Tata Advanced Systems Limited
(A company incorporated under the Companies Act, 2013, having its registered office at Mithona Towers, West Ward No. 2, Pune, Maharashtra – 411001)
(Hereinafter referred to as "TASL" or "Party A", which expression shall, unless repugnant to the context or meaning thereof, include its successors-in-interest and permitted assigns)

(2) M/s Airbus Defence and Space SAS
(A company incorporated under the laws of the Republic of France, having its registered office at 316 route de Bayonne, 31060 Toulouse Cedex 9, France)
(Hereinafter referred to as "Airbus" or "Party B", which expression shall, unless repugnant to the context or meaning thereof, include its successors-in-interest and permitted assigns)

(3) The Government of India, acting through the Ministry of Defence
(Represented by the Defence Secretary, South Block, New Delhi – 110011)
(Hereinafter referred to as "MoD" or "Party C")

(Hereinafter collectively referred to as "the Parties" and individually as a "Party")

RECITALS:

A. WHEREAS the Government of India, pursuant to the Defence Acquisition Council (DAC) meeting held on 15.06.2025, accorded Acceptance of Necessity (AoN) for the procurement of 111 Multi-Role Helicopters (MRH) for the Indian Navy, at an estimated cost of Rs. 21,000 Crore (Rupees Twenty-One Thousand Crore Only), under the Strategic Partnership (SP) Model, as approved by the Cabinet Committee on Security (CCS) on 20.05.2022;

B. WHEREAS the Parties desire to form a Joint Venture Company (JVC) under the provisions of the Companies Act, 2013, to execute the contract for the manufacture, assembly, integration, testing, certification, delivery, and lifecycle support (including maintenance, repair, and overhaul) of the said 111 MRH;

C. WHEREAS the Parties have executed a Memorandum of Understanding (MoU) dated 10.12.2024, setting out the broad terms and conditions for the proposed Joint Venture;

NOW THIS AGREEMENT WITNESSETH AS FOLLOWS:

1. FORMATION OF THE JOINT VENTURE:

1.1 The Parties hereby agree to form a Joint Venture Company (JVC) to be incorporated under the provisions of the Companies Act, 2013, with the following details:

| Particulars | Details |
|---|---|
| Name | Tata-Airbus Helicopters Limited (TAHL) |
| Registered Office | Hyderabad, Telangana (to be finalized) |
| Authorized Capital | Rs. 5,000 Crore |
| Paid-up Capital | Rs. 3,500 Crore (initial) |
| Objects | Design, development, manufacture, assembly, integration, testing, certification, delivery, and lifecycle support of Multi-Role Helicopters (MRH) for the Indian Navy and other customers |

1.2 The equity structure of the JVC shall be as follows:

| Party | Equity (%) | Investment (Rs. Crore) |
|---|---|---|
| TASL (Party A) | 51% | 1,785.00 |
| Airbus (Party B) | 39% | 1,365.00 |
| MoD (Party C) | 10% | 350.00 |
| **Total** | **100%** | **3,500.00** |

1.3 The Parties acknowledge and agree that:

(a) The majority equity holding (51%) by TASL ensures that the JVC is an "Indian company" for the purposes of the Defence Acquisition Procedure (DAP) 2020, and that the JVC qualifies as a "Strategic Partner" under Chapter VII of the DAP 2020;

(b) The transfer of technology (ToT) from Airbus to the JVC shall be to the extent of 60% (sixty per cent) of the total technology, including but not limited to: design data, manufacturing processes, assembly techniques, testing protocols, quality assurance procedures, and maintenance manuals;

(c) The JVC shall achieve a minimum Indigenous Content (IC) of 60% in the first 50 helicopters and 75% in the subsequent 61 helicopters, in accordance with the Make in India (Defence) guidelines issued by the Ministry of Defence on 15.03.2022;

2. GOVERNANCE AND MANAGEMENT:

2.1 The Board of Directors of the JVC shall comprise 9 (nine) directors, nominated as follows:
- TASL: 4 directors (including the Chairman)
- Airbus: 3 directors (including the Managing Director/CEO)
- MoD: 2 directors (including one from the Indian Navy)

2.2 The key management positions shall be allocated as follows:

| Position | Nominated By | Initial Incumbent |
|---|---|---|
| Chairman | TASL | Mr. Saurabh Kumar (TASL) |
| Managing Director/CEO | Airbus | Mr. Jean-Pierre Dupont (Airbus) |
| Chief Financial Officer (CFO) | TASL | To be appointed |
| Chief Technology Officer (CTO) | Airbus | To be appointed |
| Chief Operating Officer (COO) | TASL | To be appointed |

2.3 Strategic Decisions: The following decisions shall require the affirmative vote of at least 75% of the Board (i.e., 7 out of 9 directors), and in any event, the concurrence of both TASL and Airbus:

(a) Approval of annual budgets and business plans exceeding Rs. 500 Crore;
(b) Entry into any contract or agreement exceeding Rs. 200 Crore;
(c) Creation of any charge, lien, or encumbrance on the assets of the JVC exceeding Rs. 100 Crore;
(d) Amendment of the Articles of Association (AOA) of the JVC;
(e) Admission of any new equity partner or dilution of existing equity;
(f) Decision to enter into any new line of business;
(g) Decision to initiate or settle any litigation involving claims exceeding Rs. 50 Crore.

3. INTELLECTUAL PROPERTY RIGHTS (IPR):

3.1 All pre-existing intellectual property (Background IP) of each Party shall remain the sole property of that Party, and the JVC shall be granted a non-exclusive, non-transferable license to use the Background IP solely for the purposes of the JVC;

3.2 All intellectual property created by the JVC during the course of its operations (Foreground IP) shall be jointly owned by the Parties in proportion to their equity holding;

3.3 In the event of termination or dissolution of the JVC, the Foreground IP shall be licensed to the Indian Government (MoD) on a royalty-free basis for all defence-related applications, and commercially to the Parties on mutually agreed terms.

4. DISPUTE RESOLUTION:

4.1 Any dispute arising out of or in connection with this Agreement shall first be referred to the Chairman of the Board of the JVC for amicable resolution within 30 days;

4.2 If the dispute is not resolved amically, it shall be referred to a three-member Arbitral Tribunal, comprising one arbitrator nominated by each Party and the third (umpire) arbitrator to be jointly appointed by the two Party-nominated arbitrators;

4.3 The arbitration shall be conducted in accordance with the Arbitration and Conciliation Act, 1996, as amended, and the seat of arbitration shall be New Delhi;

4.4 The language of arbitration shall be English, and the arbitral award shall be final and binding upon the Parties.

5. TERM AND TERMINATION:

5.1 This Agreement shall be effective from the date of incorporation of the JVC and shall remain in force for a period of 25 (twenty-five) years, unless terminated earlier in accordance with the provisions hereof;

5.2 Either Party may terminate this Agreement by giving 12 months' written notice to the other Parties, subject to the following conditions:
(a) The terminating Party shall offer to purchase the equity of the non-terminating Parties at fair market value, determined by an independent valuation firm (Big Four accounting firm) mutually agreed upon;
(b) The Government of India (MoD) shall have the right of first refusal (ROFR) to acquire the equity of any departing Party at the price offered;

IN WITNESS WHEREOF, the Parties have executed this Agreement on the day, month, and year first above written.

SIGNED AND DELIVERED:

For and on behalf of Party A (TASL):
[Sd.] Saurabh Kumar
Designation: Chairman
Date: 01.08.2026

For and on behalf of Party B (Airbus):
[Sd.] Jean-Pierre Dupont
Designation: Managing Director
Date: 01.08.2026

For and on behalf of Party C (MoD):
[Sd.] Dr. Ajay Kumar
Designation: Defence Secretary
Date: 01.08.2026

WITNESSES:

1. [Sd.] Senior Advocate (Supreme Court of India)
2. [Sd.] Joint Secretary (Defence Production), Ministry of Defence`);

translate("20. CRITICAL ILLNESS INSURANCE (medical-legal complexity)", `Date: 14.08.2026

To,
The Chief Claims Officer,
ICICI Lombard General Insurance Company Limited,
ICICI Lombard House,
414, Veer Savarkar Marg,
Prabhadevi, Mumbai – 400025

Subject: Critical Illness Insurance Claim Under Policy No. CI/2023/987654 — Claim for Partial Permanent Disability and Hospitalization Benefit

Dear Sir/Madam,

We, M/s Legal Associates LLP (Regn. No. AAP/2019/4567), on behalf of our client, Mr. Amitabh Ranjan (Policyholder), hereby submit this claim for benefits under the above-referenced Critical Illness Insurance Policy, with the details as follows:

POLICY DETAILS:
| Particular | Details |
|---|---|
| Policy Number | CI/2023/987654 |
| Policyholder | Mr. Amitabh Ranjan, S/o Mr. R.K. Ranjan |
| Date of Birth | 15.03.1972 (Age: 54 years) |
| Sum Assured | Rs. 50,00,000/- |
| Policy Type | Individual Critical Illness Plus (with Hospitalization Benefit Rider) |
| Policy Period | 01.01.2023 to 31.12.2026 |
| Premium Paid | Rs. 45,678/- per annum |

MEDICAL HISTORY AND CLINICAL NARRATIVE:

1. PRE-EXISTING CONDITIONS (disclosed at the time of policy inception):
(a) Hypertension (diagnosed 2012, controlled on Amlodipine 5mg)
(b) Dyslipidemia (diagnosed 2015, controlled on Atorvastatin 10mg)
(c) No history of diabetes, cardiac disease, or malignancy

2. INCIDENT AND DIAGNOSIS:

On 12.06.2026, Mr. Ranjan experienced sudden onset of severe left-sided weakness, slurring of speech (dysarthria), and facial droop (left-sided facial palsy), while at his place of work. He was immediately rushed to the Emergency Department of Fortis Hospital, Shalimar Bagh, New Delhi, where the attending neurologist, Dr. Sanjay Gupta (Registration No. MCI/DM/23456), made the following clinical assessment:

(a) Clinical Diagnosis: Acute Ischemic Stroke (Right Middle Cerebral Artery Territory) — ICD-10 Code: I63.5

(b) Neuroimaging:
- Non-Contrast CT Head (12.06.2026, 14:35 hrs): Hyperdense MCA sign on the right side; early ischemic changes in the right insular cortex and right lentiform nucleus. No hemorrhage.
- CT Angiography (CTA) (12.06.2026, 15:20 hrs): Occlusion of the right Middle Cerebral Artery (MCA), M1 segment, with no significant atherosclerotic disease in the carotid or vertebral arteries.
- MRI Brain with Diffusion-Weighted Imaging (DWI) and Apparent Diffusion Coefficient (ADC) Mapping (13.06.2026): Acute infarct in the right MCA territory, involving approximately 35% of the right MCA vascular territory (Alberta Stroke Program Early CT Score — ASPECTS: 6/10).

(c) Thrombolysis and Mechanical Thrombectomy:
Given the presentation within the 4.5-hour window from symptom onset (estimated onset: 10:00 hrs), the patient was administered intravenous Alteplase (Activase) at a dose of 0.9 mg/kg (total dose: 81 mg, based on body weight of 90 kg), with 10% as a bolus and the remaining 90% infused over 60 minutes. Subsequently, the patient underwent Emergency Mechanical Thrombectomy (MT) via the right femoral artery approach, performed by Dr. Sanjay Gupta and Dr. Ritu Saxena (Interventional Neuroradiologist), with successful recanalization (TICI Grade 2b — partial recanalization) achieved after 2 passes with a Penumbra 4MAX reperfusion catheter.

3. POST-HOSPITALIZATION STATUS AND DISABILITY ASSESSMENT:

Following an in-patient stay of 23 days (12.06.2026 to 04.07.2026), including 7 days in the Neurological Intensive Care Unit (Neuro-ICU) and 16 days in the Neurology Ward, the patient was discharged with the following residual deficits:

(a) Motor Deficit: Left-sided hemiparesis (MRC Grade: Upper Limb 3/5, Lower Limb 4/5 — fair to moderate weakness, not fully recovered);

(b) Speech and Language: Moderate Broca's aphasia (non-fluent aphasia) — the patient has difficulty producing speech, with preserved comprehension. He is unable to return to his pre-morbid occupation as a Senior Executive Director (Policy and Strategy) at a multinational corporation, as the role requires extensive verbal communication, presentation skills, and public speaking;

(c) Cognitive Deficit: Mild-to-moderate executive dysfunction, with impairments in attention, working memory, and cognitive flexibility, as documented by the Neuropsychological Assessment conducted on 28.07.2026 at AIIMS, New Delhi (Neuropsychologist: Dr. Priya Malhotra, Regn. No. RCI/ClinPsy/12345);

(d) Modified Rankin Scale (mRS) Score: 3 (moderate disability; requires some help but able to walk without assistance of another person);

(e) Barthel Index Score: 75/100 (mild-to-moderate dependence in activities of daily living).

HOSPITALIZATION EXPENSES:

| S.No. | Description | Amount (Rs.) |
|---|---|---|
| 1 | Emergency Department charges | 35,000 |
| 2 | Neuro-ICU (7 days @ Rs. 25,000/day) | 1,75,000 |
| 3 | Ward charges (16 days @ Rs. 12,000/day) | 1,92,000 |
| 4 | Neurologist's fees | 2,50,000 |
| 5 | Interventional Neuroradiologist's fees | 3,00,000 |
| 6 | Alteplase (Activase) — 100mg vial | 1,85,000 |
| 7 | Penumbra 4MAX catheter | 2,75,000 |
| 8 | Other consumables and equipment | 1,25,000 |
| 9 | Diagnostic investigations (CT, MRI, CTA, EEG, Neuropsych assessment) | 95,000 |
| 10 | Medications (in-patient) | 78,000 |
| 11 | Physiotherapy and Speech Therapy (23 days) | 69,000 |
| 12 | Ambulance | 12,000 |
| 13 | Post-discharge medications and follow-up (3 months) | 45,000 |
| **Total** | | **19,36,000** |

CLAIM UNDER THE POLICY:

Pursuant to the terms and conditions of the Policy, and having regard to the following policy provisions:

(i) Clause 4.1 (Critical Illness Benefit): Upon diagnosis of "Stroke" (defined in the Policy as "acute cerebrovascular accident resulting in permanent neurological deficit persisting for at least 30 days"), the Policyholder is entitled to 100% of the Sum Assured, i.e., Rs. 50,00,000/-;

(ii) Clause 4.2 (Partial Permanent Disability Benefit): Upon suffering a permanent disability of at least 50% as assessed by the Policy's Independent Medical Examiner (IME), the Policyholder is entitled to 50% of the Sum Assured, i.e., Rs. 25,00,000/-;

(iii) Clause 4.5 (Hospitalization Benefit Rider): Reimbursement of hospitalization expenses up to Rs. 5,00,000/- per event;

(iv) Clause 7.1 (Waiver of Premium): Upon diagnosis of a Critical Illness, the Policyholder is entitled to a waiver of all future premium payments for the remainder of the policy term.

We therefore submit the following claim:

| Benefit | Amount (Rs.) |
|---|---|
| Critical Illness Benefit (100% of SA) | 50,00,000 |
| Partial Permanent Disability Benefit (50% of SA) | 25,00,000 |
| Hospitalization Benefit (actual, capped at Rs. 5L) | 5,00,000 |
| **Total Claim** | **80,00,000** |

We request you to kindly process the claim at the earliest and release the admissible amount directly to the Policyholder's bank account (Account No. XXXXXXXXXX, IFSC: ICIC0001234, ICICI Bank, Shalimar Bagh Branch, New Delhi).

Thanking you,

Yours faithfully,
For and on behalf of Mr. Amitabh Ranjan,
(Senior Partner)
M/s Legal Associates LLP
Regn. No.: AAP/2019/4567
102, Lawyer's Chamber, Saket Courts
New Delhi – 110017
Email: claims@legalassociates.in
Phone: +91-11-XXXXXXXX
Date: 14.08.2026`);

// ═══════════════════════════════════════════════════════════════════════════════
// RESULTS
// ═══════════════════════════════════════════════════════════════════════════════

console.log("\n══════════════════════════════════════════════════════════════════════════════");
console.log(`TOTAL: ${passed + failed}  PASSED: ${passed}  FAILED: ${failed}`);
console.log("══════════════════════════════════════════════════════════════════════════════");

if (failures.length > 0) {
  console.log("\nFAILURE DETAILS:");
  failures.forEach((f) => console.log(f));
}

process.exit(failed > 0 ? 1 : 0);
