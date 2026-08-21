# ODA Letter Forge Report

- **Input:** `letters/8-ALL NEW LETTER` — 71 letter file(s)
- **Output:** `letters/out`
- **Pipeline:** app extraction (DOCX structural / DOC OLE2) → translateAdaptive (Hindi) → adaptiveGenerate (response)

| Letter | Format | Chars | Script | Hindi translation | Untranslated lines | Response ok |
|---|---|---|---|---|---|---|
| 0-LETTER[1]SIBA-5.docx | docx | 50 | English | ✅ | 0 | ✅ |
| 0-NEW LETTER (SINGRAULI) L.C.-OUT .docx | docx | 1203 | English | ✅ | 0 | ✅ |
| 1-BAPI-(REMINDER)-(II)/143-SHRI SAGAR KUMAR SINGH (NAGPUR-WCL)L.C. REQ..docx | docx | 1555 | English | ✅ | 0 | ✅ |
| 1-BAPI-(REMINDER)-(II)/144-SHRI SANTOSH KUMAR NISHAD (NAGPUR-WCL)L.C. REQ..docx | docx | 1564 | English | ✅ | 0 | ✅ |
| 106-SH. BIBEK PRUSTY (TALCHER) - (L.C.-OUT).docx | docx | 1293 | English | ✅ | 0 | ✅ |
| 111-SHRI ANJANI KUMAR SINGH (NAGPUR - WCL) - (L.C.-Requisition).docx | docx | 1246 | English | ✅ | 0 | ✅ |
| 121-SHRI RAJESH KUMAR BARIK- EXTRACT (SINGRAULI).docx | docx | 528 | English | ✅ | 0 | ✅ |
| 123-BIRENDRA KUMAR SINGH- EXTRACT (SINGRAULI).docx | docx | 528 | English | ✅ | 0 | ✅ |
| 124-B.MAHAMOOD MIYA- EXTRACT (TALCHER).docx | docx | 605 | English | ✅ | 0 | ✅ |
| 125-SHRI SAMIRAN MUKHERJEE (DHANBAD-D1) EXTRACT.docx | docx | 546 | English | ✅ | 0 | ✅ |
| 129-SHRI BHASKAR KUMAR SINHA (DHANBAD-D-II)L.C.OUT .docx | docx | 1203 | English | ✅ | 0 | ✅ |
| 133-SHRI ANAND KUMAR DUBEY (DHANBAD-D1) EXTRACT.docx | docx | 536 | English | ✅ | 0 | ✅ |
| 135-LAKSHMIDHAR DAS (BILAPSUR) EXTRACT.docx | docx | 539 | English | ✅ | 0 | ✅ |
| 138-SHRI KISHORE RAM RATAN (SAMBALPUR-MCL)EXTRACT.docx | docx | 542 | English | ✅ | 0 | ✅ |
| 147-RAVINDRA YADAV- EXTRACT (SINGRAULI).docx | docx | 535 | English | ✅ | 0 | ✅ |
| 153-SURENDRA KOIRI- EXTRACT (SINGRAULI) .docx | docx | 510 | English | ✅ | 0 | ✅ |
| 162-SHRI KHADAL JENA (TALCHER-L.C.-OUT).docx | docx | 1240 | English | ✅ | 0 | ✅ |
| 179-SHRI SUSANTA KUMAR NAYAK (SAMBALPUR-MCL)(L.C.-OUT).docx | docx | 520 | English | ✅ | 0 | ✅ |
| 180-LATE RAJA VENKATESH BODIGA (NAGPUR-L.C.-OUT)WCL.docx | docx | 1217 | English | ✅ | 0 | ✅ |
| 198-SHRI TONMOY BHATTACHARJEE & HIROK SARKAR-L.C. OUT (REGIONAL OFFICE-III).docx | docx | 1309 | English | ✅ | 0 | ✅ |
| 2-LAHA DADA-(REMINDER)-(II)/120-SHRI PRASANTA KUMAR ROUTRAY (BILASPUR)) - (L.C.-Requisition) .docx | docx | 1403 | English | ✅ | 0 | ✅ |
| 2-LAHA DADA-(REMINDER)-(II)/120-SHRI PRASANTA KUMAR ROUTRAY (DHANBAD -(I&II)) - (L.C.-Requisition).docx | docx | 1526 | English | ✅ | 0 | ✅ |
| 2-LAHA DADA-(REMINDER)-(II)/120-SHRI PRASANTA KUMAR ROUTRAY (RANCHI -I&II) - (L.C.-Requisition).docx | docx | 1570 | English | ✅ | 0 | ✅ |
| 2-LAHA DADA-(REMINDER)-(II)/120-SHRI PRASANTA KUMAR ROUTRAY (SAMBALPUR-SBP) - (L.C.-Requisition).docx | docx | 1631 | English | ✅ | 0 | ✅ |
| 205-SHRI BINAY KUMAR PATTANAYAK (NAGPUR-WCL)L.C. REQ..docx | docx | 1409 | English | ✅ | 0 | ✅ |
| 212-SHRI SAIKAT MONDAL & SURJAKANTA NAYAK-L.C. OUT (REGIONAL OFFICE-III).docx | docx | 1305 | English | ✅ | 0 | ✅ |
| 217-SHRI ANIL RAJBHAR (SINGRAULI) L.C.-OUT (HINDI) .docx | docx | 2161 | dual | ✅ | 0 | ✅ |
| 217-SHRI DHARAMRAJ KURMI (SINGRAULI) L.C.-OUT (HINDI) .docx | docx | 2355 | dual | ✅ | 0 | ✅ |
| 218- SHRI BINOD KUMAR (BILASPUR)L.C. OUT (HINDI) .doc | doc | 2421 | dual | ❌ | 1 | ✅ |
| 219-SHRI SANJOY KUMAR SINGH (DHANBAD-(D-I  & II)L.C. REQ. .docx | docx | 1482 | English | ✅ | 0 | ✅ |
| 219-SHRI SANJOY KUMAR SINGH (RANCHI-(R-I  & II)L.C. REQ. .docx | docx | 1357 | English | ✅ | 0 | ✅ |
| 220-SHRI GURUCHARAN NIKHANDIA (SAMBALPUR-MCL)EXTRACT.docx | docx | 543 | English | ✅ | 0 | ✅ |
| 221-JAYDEV ROY (SAMBALPUR-M.C.L.) L.C.-REQ. .docx | docx | 1467 | English | ✅ | 0 | ✅ |
| 3-PAPU-(REMINDER)-(I)/92-MR. BHASKAR PAL - L.C. REQ. (DHANBAD, D-I).docx | docx | 1315 | English | ✅ | 0 | ✅ |
| 3-PAPU-(REMINDER)-(I)/92-MR. BHASKAR PAL - L.C. REQ. (NAGPUR) .docx | docx | 1309 | English | ✅ | 0 | ✅ |
| 4-MR.BHASKAR PAL/92-MR. BHASKAR PAL - L.C. REQ. (DHANBAD, D-I) (2).docx | docx | 1004 | English | ✅ | 0 | ✅ |
| 4-MR.BHASKAR PAL/92-MR. BHASKAR PAL - L.C. REQ. (NAGPUR)  (2).docx | docx | 999 | English | ✅ | 0 | ✅ |
| 5-SHRI SOURABH MALI(BILAPSUR-SECL)L.C. REQUISITION/173-SHRI SOURABH MALI(BILAPSUR-SECL)L.C. REQUISITION  (2).docx | docx | 1570 | English | ❌ | 1 | ✅ |
| 6-RAJESH BOURI (BILASPUR - SECL)L.C. Requisition (REMINDER)/117-RAJESH BOURI (BILASPUR - SECL)L.C. Requisition (REMINDER).docx | docx | 1789 | English | ✅ | 0 | ✅ |
| 6-RAJESH BOURI (BILASPUR - SECL)L.C. Requisition (REMINDER)/203-NIMAI CHANDRA ROUTH- L.C.REQ. (ASANSOL-R-III).docx | docx | 1438 | English | ✅ | 0 | ✅ |
| 7-SHRI SUNNY VISHWAKARMA & MANAS KUMAR MONDAL/208-SHRI SUNNY VISHWAKARMA(BILAPSUR-SECL)L.C. REQUISITION .docx | docx | 1680 | English | ✅ | 0 | ✅ |
| 7-SHRI SUNNY VISHWAKARMA & MANAS KUMAR MONDAL/209-SHRI MANAS KUMAR MONDAL (NAGPUR-WCL)L.C. REQ..docx | docx | 1680 | English | ✅ | 0 | ✅ |
| 85-SHRI RAJENDRA KUMAR HARIJAN (SINGRAULI)EXTRACT.docx | docx | 527 | English | ✅ | 0 | ✅ |
| 97-SHRI Mahendra Pratap Singh- EXTRACT (SINGRAULI).docx | docx | 522 | English | ✅ | 0 | ✅ |
| 99-AKSHAY BALSARAF - EXTRACT (NAGPUR).docx | docx | 550 | English | ✅ | 0 | ✅ |
| C SRIKANTH - EXTRACT (NAGPUR).docx | docx | 551 | English | ✅ | 0 | ✅ |
| D-K-P-ALL LETTER FORMAT (NEW)/(I)-LC Requisition - Deoghar (SIBA-3.docx | docx | 1345 | English | ✅ | 0 | ✅ |
| D-K-P-ALL LETTER FORMAT (NEW)/(III)-EXTRACT To Be Forwarded (RANCHI)[1]SIBA-2.docx | docx | 515 | English | ✅ | 0 | ✅ |
| D-K-P-ALL LETTER FORMAT (NEW)/(III)-EXTRACT To Be Forwarded (RANCHI)[1]SIBS.docx | docx | 556 | English | ✅ | 0 | ✅ |
| D-K-P-ALL LETTER FORMAT (NEW)/LETTER(SIBA)4.docx | docx | 722 | English | ✅ | 0 | ✅ |
| D-K-P-ALL LETTER FORMAT (NEW)/LETTER[1]SIBA-5.docx | docx | 50 | English | ✅ | 0 | ✅ |
| D-K-P-ALL LETTER FORMAT (NEW-1)/(I)-LC Requisition - Deoghar (SIBA-3.docx | docx | 1347 | English | ✅ | 0 | ✅ |
| D-K-P-ALL LETTER FORMAT (NEW-1)/(III)-EXTRACT To Be Forwarded (RANCHI)[1]SIBA-2.docx | docx | 512 | English | ✅ | 0 | ✅ |
| D-K-P-ALL LETTER FORMAT (NEW-1)/(III)-EXTRACT To Be Forwarded (RANCHI)[1]SIBS.docx | docx | 530 | English | ✅ | 0 | ✅ |
| D-K-P-ALL LETTER FORMAT (NEW-1)/DEMO - Copy.docx | docx | 1347 | English | ✅ | 0 | ✅ |
| D-K-P-ALL LETTER FORMAT (NEW-1)/LETTER(SIBA)4.docx | docx | 847 | English | ❌ | 1 | ✅ |
| D-K-P-ALL LETTER FORMAT (NEW-1)/LETTER[1]SIBA-5.docx | docx | 847 | English | ❌ | 1 | ✅ |
| D.K.P.-ALL LETTAR FORMAT/(I)-LC Requisition - Deoghar.docx | docx | 1354 | English | ✅ | 0 | ✅ |
| D.K.P.-ALL LETTAR FORMAT/(II)-LC To Be Forwarded (DHANBAD-II) - (L.C.-OUT).docx | docx | 1244 | English | ✅ | 0 | ✅ |
| D.K.P.-ALL LETTAR FORMAT/(III)-EXTRACT To Be Forwarded (RANCHI).docx | docx | 559 | English | ✅ | 0 | ✅ |
| HINDI OFFICE WORKS/113-ARUN KUMAR - DEOGHAR.docx | docx | 1509 | dual | ✅ | 0 | ✅ |
| HINDI OFFICE WORKS/113-SATYA NARAYAN MAHATO - DEOGHAR.docx | docx | 1292 | dual | ✅ | 0 | ✅ |
| HINDI OFFICE WORKS/114-DEVANTI PANDEY - EXTRACT (SINGRAULI).docx | docx | 601 | dual | ✅ | 0 | ✅ |
| HINDI OFFICE WORKS/114-SHRIMATI DEVANTI PANDEY- EXTRACT (SINGRAULI).docx | docx | 538 | English | ✅ | 0 | ✅ |
| HINDI OFFICE WORKS/115- SANTOSH RAO-EXTRACT (DEOGHAR).docx | docx | 544 | dual | ✅ | 0 | ✅ |
| HINDI OFFICE WORKS/115-SANTOSH RAO - EXTRACT (DEOGHAR).docx | docx | 596 | English | ✅ | 0 | ✅ |
| HINDI OFFICE WORKS/RITESH/113-ARUN KUMAR - DEOGHAR.docx | docx | 1521 | dual | ✅ | 0 | ✅ |
| RAM PALT HARIJAN - EXTRACT (SINGRAULI).docx | docx | 538 | English | ✅ | 0 | ✅ |
| SHRI KRISHNA,KANCHAN,RANJEET - EXTRACT (DEOGHAR).docx | docx | 723 | English | ✅ | 0 | ✅ |
| SHRI MADHUSUDAN MADHAV (SINGRAULI) - (L.C.-REQ & EXTRACT).docx | docx | 1226 | English | ✅ | 0 | ✅ |
| SHRI RAJENDRA KUMAR HARIJAN (SINGRAULI) - (L.C.-OUT).docx | docx | 1179 | English | ✅ | 0 | ✅ |

- Complete Hindi translations: 67/71
- Incomplete: 218- SHRI BINOD KUMAR (BILASPUR)L.C. OUT (HINDI) .doc; 5-SHRI SOURABH MALI(BILAPSUR-SECL)L.C. REQUISITION/173-SHRI SOURABH MALI(BILAPSUR-SECL)L.C. REQUISITION  (2).docx; D-K-P-ALL LETTER FORMAT (NEW-1)/LETTER(SIBA)4.docx; D-K-P-ALL LETTER FORMAT (NEW-1)/LETTER[1]SIBA-5.docx

_Generated by scripts/forge-letters.ts — runs the same code the browser uses._