<!--
  TEMPLATE: QA Scorecard — Run Summary
  Generated once after successful individual scorecards. Static wording is editable.
  Keep every {{placeholder}} unless the report renderer is updated with it.
-->

# 📊 {{company_name}} - QA Audit Summary Report

- **মূল্যায়ন তারিখ:** {{evaluation_date}}
- **পরিমাপকৃত মোট কল সংখ্যা:** {{total_calls}}
- **ব্যবহৃত প্যারামিটার সেট:** {{parameter_set_name}}

## ১. সামগ্রিক স্কোর সারাংশ (Overall Score Summary)

| এজেন্ট | মোট কল | গড় স্কোর | সর্বোচ্চ স্কোর | সর্বনিম্ন স্কোর | Critical Error যুক্ত কল |
| :--- | ---: | ---: | ---: | ---: | ---: |
{{agent_summary_rows}}

## ২. ক্যাটাগরি-ভিত্তিক গড় পারফরম্যান্স (Category-Wise Average Performance)

| ক্যাটাগরি | সর্বোচ্চ নম্বর | গড় অর্জিত নম্বর | গড় কাটা নম্বর |
| :--- | ---: | ---: | ---: |
{{category_average_rows}}

## ৩. পুনরাবৃত্ত সমস্যাসমূহ (Recurring Issues Across Calls)

{{recurring_issues_list}}

## ৪. সেরা পারফরম্যান্স ও দুর্বল পারফরম্যান্স কলসমূহ (Best & Worst Performing Calls)

{{best_and_worst_calls}}

## ৫. সামগ্রিক অ্যাকশনেবল সুপারিশ (Overall Actionable Recommendations)

{{overall_recommendations}}
