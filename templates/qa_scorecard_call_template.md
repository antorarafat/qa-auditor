<!--
  TEMPLATE: QA Scorecard — Individual Call Report
  One report is generated per successful call. Static wording is editable.
  Keep every {{placeholder}} unless the report renderer is updated with it.
-->

# 📊 {{company_name}} - QA Audit & Call Scorecard Report

## ১. কলের সংক্ষিপ্ত তথ্য (Call Summary)

- **কল বিষয়বস্তু:** {{call_summary}}
- **ক্লায়েন্ট টাইপ ও চাহিদা:** {{client_type_and_need}}
- **কলের স্থায়িত্বকাল ও টোন:** {{call_duration_and_tone}}
- **এজেন্টের নাম:** {{agent_name}}
- **মূল্যায়ন তারিখ:** {{evaluation_date}}
- **চূড়ান্ত স্কোর:** **{{final_score}} / {{max_score}}** {{critical_error_note}}

## ২. প্রোডাক্ট ফ্যাক্ট-চেক ও ক্রিটিক্যাল এরর অডিট (Product Fact-Check & Critical Error Audit)

- **প্রোডাক্ট তথ্য যাচাই:** {{product_fact_check}}
- **Critical Error (CE) অডিট:** {{ce_audit_details}}
- **CE Alert:** {{ce_alert}}

## ৩. QA স্কোরকার্ড ও স্কোর ব্রেকডাউন (QA Scorecard Breakdown)

| প্যারামিটার | সর্বোচ্চ নম্বর | অর্জিত নম্বর | কাটা নম্বর | টাইমস্ট্যাম্প [MM:SS] | নম্বর কাটার বিবরণ ও সংক্ষেপ |
| :--- | ---: | ---: | ---: | :---: | :--- |
{{scorecard_rows}}
| **সর্বমোট নম্বর (Total Score)** | **{{max_score}}** | **{{achieved_score}}** | **{{deducted_score}}** | **—** | **{{status_label}}** |

## ৪. মার্ক কাটার বিস্তারিত কারণ ও বিচার বিশ্লেষণ (Deduction Justification)

{{deduction_justification_sections}}

## ৫. এডভাইসরের ভালো দিকসমূহ (Strengths / Pros)

{{strengths_list}}

## ৬. ভুল Approach বনাম সঠিক Approach (Script Correction)

| টাইমস্ট্যাম্প | ভুল / দুর্বল Approach | সঠিক Approach |
| :---: | :--- | :--- |
{{script_correction_pairs}}

## ৭. অ্যাকশনেবল পরামর্শ ও ফাইনাল পারফরম্যান্স রেটিং (Actionable Coaching & Final Rating)

**কাজের মানোন্নয়নের জন্য স্পষ্ট টিপস:**

{{actionable_tips}}

> **Overall Status:** {{overall_status}}<br>
> **সর্বমোট অর্জিত স্কোর:** {{achieved_score}} / {{max_score}}
