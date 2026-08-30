import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  Check,
  ChevronLeft,
  FileText,
  FileDown,
  KeyRound,
  Eye,
  Trash2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  DatePicker,
  Input,
  Label,
  Select,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from "./components/ui";
import { useLanguage } from "./language";
import { MultiSelect } from "./components/multi-select";

const bnCopy = {
  "The request could not be completed.": "অনুরোধটি সম্পন্ন করা যায়নি।",
  "The request timed out. Please try again.":
    "অনুরোধের সময় শেষ হয়েছে। আবার চেষ্টা করুন।",
  "Set up QA Auditor": "QA Auditor সেটআপ করুন",
  "Create the first administrator. The setup token comes from your server’s .env file and works only once.":
    "প্রথম অ্যাডমিন তৈরি করুন। সেটআপ টোকেনটি সার্ভারের .env ফাইলে রয়েছে এবং একবারই ব্যবহার করা যাবে।",
  "Setup token": "সেটআপ টোকেন",
  Email: "ইমেইল",
  Username: "ইউজারনেম",
  "Company name": "কোম্পানির নাম",
  Password: "পাসওয়ার্ড",
  "Use 12–128 characters and do not include the username or email name.":
    "১২–১২৮ অক্ষর ব্যবহার করুন এবং ইউজারনেম বা ইমেইলের নাম পাসওয়ার্ডে রাখবেন না।",
  "Creating…": "তৈরি হচ্ছে…",
  "Create administrator": "অ্যাডমিন তৈরি করুন",
  "The new passwords do not match.": "নতুন পাসওয়ার্ড দুটি মিলছে না।",
  "Current password": "বর্তমান পাসওয়ার্ড",
  "New password": "নতুন পাসওয়ার্ড",
  "Confirm new password": "নতুন পাসওয়ার্ড নিশ্চিত করুন",
  "Saving…": "সেভ হচ্ছে…",
  "Change password": "পাসওয়ার্ড পরিবর্তন",
  "Set a private password": "নিজস্ব পাসওয়ার্ড সেট করুন",
  "Your temporary password must be replaced before you can continue. Changing it signs out every device.":
    "চালিয়ে যাওয়ার আগে অস্থায়ী পাসওয়ার্ড পরিবর্তন করতে হবে। পরিবর্তন করলে সব ডিভাইস থেকে লগআউট হবে।",
  "Account security": "অ্যাকাউন্ট নিরাপত্তা",
  "Manage your password and personal provider keys. Administrators cannot see these keys.":
    "নিজের পাসওয়ার্ড ও ব্যক্তিগত প্রোভাইডার key পরিচালনা করুন। অ্যাডমিনরা এই key দেখতে পারবেন না।",
  "Changing your password signs out every active device.":
    "পাসওয়ার্ড পরিবর্তন করলে সব সক্রিয় ডিভাইস থেকে লগআউট হবে।",
  "API keys": "API key",
  "Keys are encrypted. Saved values are never shown again.":
    "Key এনক্রিপ্টেড থাকে। সেভ করা সম্পূর্ণ key আর দেখানো হবে না।",
  "Not configured": "সেট করা নেই",
  Remove: "মুছুন",
  "Remove key": "Key মুছুন",
  "Audits using this provider will be unavailable until you add another key.":
    "নতুন key যোগ না করা পর্যন্ত এই প্রোভাইডার দিয়ে অডিট করা যাবে না।",
  Provider: "প্রোভাইডার",
  "New API key": "নতুন API key",
  "Paste a new key": "নতুন key পেস্ট করুন",
  "Checking…": "যাচাই হচ্ছে…",
  "Validate and save": "যাচাই করে সেভ করুন",
  "API key encrypted and saved.": "API key এনক্রিপ্ট করে সেভ করা হয়েছে।",
  "API key removed.": "API key মুছে ফেলা হয়েছে।",
  "QA scorecard": "QA স্কোরকার্ড",
  "Customer voice": "কাস্টমার ভয়েস",
  "Advisor coaching": "এডভাইসর কোচিং",
  "Legacy report": "পুরোনো রিপোর্ট",
  "Report detail": "রিপোর্টের বিস্তারিত",
  Back: "ফিরে যান",
  Print: "প্রিন্ট",
  Word: "Word",
  Copy: "কপি",
  User: "ব্যবহারকারী",
  Manager: "ম্যানেজার",
  Admin: "অ্যাডমিন",
  Model: "মডেল",
  Reasoning: "রিজনিং",
  "Estimated API cost": "আনুমানিক API খরচ",
  "Evidence cache": "এভিডেন্স ক্যাশ",
  hits: "হিট",
  misses: "মিস",
  "Not recorded": "সংরক্ষিত নেই",
  Source: "উৎস",
  Cached: "ক্যাশড",
  Fresh: "নতুন",
  Company: "কোম্পানি",
  Parameter: "প্যারামিটার",
  Generic: "সাধারণ",
  "Call failed": "কল ব্যর্থ",
  Reports: "রিপোর্ট",
  "All completed audit and insight reports.":
    "সব সম্পন্ন অডিট ও ইনসাইট রিপোর্ট।",
  "Your completed audit and insight reports.":
    "আপনার সম্পন্ন অডিট ও ইনসাইট রিপোর্ট।",
  "Search filename, user, or text": "ফাইল, ব্যবহারকারী বা লেখা খুঁজুন",
  "All modes": "সব ধরন",
  "Report mode": "রিপোর্টের ধরন",
  "All CE statuses": "সব CE অবস্থা",
  "CE status": "CE অবস্থা",
  "Has CE": "CE আছে",
  "Non-CE": "Non-CE",
  "All users": "সব ব্যবহারকারী",
  "All agents": "সব এজেন্ট",
  "All processes": "সব প্রক্রিয়া",
  "Search agents": "এজেন্ট খুঁজুন",
  "Search processes": "প্রক্রিয়া খুঁজুন",
  "Search modes": "রিপোর্টের ধরন খুঁজুন",
  "No results": "কোনো ফল নেই",
  "{count} selected": "{count}টি নির্বাচিত",
  "Calls evaluated": "মূল্যায়িত কল",
  "Average QA score": "গড় QA স্কোর",
  "AHT": "AHT",
  "CE count": "CE সংখ্যা",
  Summary: "সারাংশ",
  Select: "নির্বাচন",
  "Generate Summary": "সারাংশ তৈরি করুন",
  "Report owner": "রিপোর্টের ব্যবহারকারী",
  "From date": "শুরুর তারিখ",
  "To date": "শেষ তারিখ",
  "Min score": "সর্বনিম্ন স্কোর",
  "Minimum score": "সর্বনিম্ন স্কোর",
  "Max score": "সর্বোচ্চ স্কোর",
  "Maximum score": "সর্বোচ্চ স্কোর",
  "No reports yet": "এখনও কোনো রিপোর্ট নেই",
  "Completed audits and insight reports will appear here.":
    "সম্পন্ন অডিট ও ইনসাইট রিপোর্ট এখানে দেখা যাবে।",
  "Load more": "আরও দেখুন",
  "Loading reports…": "রিপোর্ট লোড হচ্ছে…",
  "Report run": "রিপোর্ট রান",
  "New Audit": "নতুন অডিট",
  "Create user": "ব্যবহারকারী তৈরি করুন",
  "API keys are added privately by each user.":
    "প্রত্যেক ব্যবহারকারী নিজের API key ব্যক্তিগতভাবে যোগ করবেন।",
  "Temporary password": "অস্থায়ী পাসওয়ার্ড",
  Accounts: "অ্যাকাউন্ট",
  Deactivate: "নিষ্ক্রিয় করুন",
  Reactivate: "সক্রিয় করুন",
  "Reset password": "পাসওয়ার্ড রিসেট",
  "Save temporary password": "অস্থায়ী পাসওয়ার্ড সেভ করুন",
  Cancel: "বাতিল",
  "User created with a temporary password.":
    "অস্থায়ী পাসওয়ার্ডসহ ব্যবহারকারী তৈরি হয়েছে।",
  "Temporary password saved. Their existing sessions were revoked.":
    "অস্থায়ী পাসওয়ার্ড সেভ হয়েছে এবং আগের সব সেশন বাতিল হয়েছে।",
  "Company name saved for future reports.":
    "ভবিষ্যৎ রিপোর্টের জন্য কোম্পানির নাম সেভ হয়েছে।",
  "Save company": "কোম্পানি সেভ করুন",
  "Network access": "নেটওয়ার্ক অ্যাক্সেস",
  "This policy protects the entire application. Keep your current address allowed before saving.": "এই নীতি পুরো অ্যাপ্লিকেশন সুরক্ষিত রাখে। সেভ করার আগে আপনার বর্তমান ঠিকানা অনুমোদিত রাখুন।",
  "Allow all networks": "সব নেটওয়ার্ক অনুমোদন করুন",
  "Allowed IPv4 ranges": "অনুমোদিত IPv4 রেঞ্জ",
  "Allowed IPv6 ranges": "অনুমোদিত IPv6 রেঞ্জ",
  "One address or CIDR range per line. Wildcard access uses 0.0.0.0/0 and ::/0." : "প্রতি লাইনে একটি ঠিকানা বা CIDR রেঞ্জ। সব নেটওয়ার্কের জন্য 0.0.0.0/0 এবং ::/0 ব্যবহার করুন।",
  "Save network policy": "নেটওয়ার্ক নীতি সেভ করুন",
  "Network policy saved.": "নেটওয়ার্ক নীতি সেভ হয়েছে।",
  Use: "ব্যবহার",
  "Address or CIDR": "ঠিকানা বা CIDR",
  "Add address": "ঠিকানা যোগ করুন",
  "Remove address": "ঠিকানা মুছুন",
  address: "ঠিকানা",
  "Select the rows that should be allowed. Wildcards are selected by default.": "যে সারিগুলো অনুমোদিত হবে সেগুলো নির্বাচন করুন। ওয়াইল্ডকার্ড ডিফল্টভাবে নির্বাচিত থাকে।",
  "Add and select another address before disabling wildcard access.": "ওয়াইল্ডকার্ড বন্ধ করার আগে অন্য একটি ঠিকানা যোগ করে নির্বাচন করুন।",
  "Disabling wildcard access may block users outside the selected addresses. Continue?": "ওয়াইল্ডকার্ড বন্ধ করলে নির্বাচিত ঠিকানার বাইরের ব্যবহারকারীরা ব্লক হতে পারেন। চালিয়ে যাবেন?",
  "How to fill this": "কীভাবে পূরণ করবেন",
  "An IP address is the number that identifies a device on your network.": "IP ঠিকানা হলো আপনার নেটওয়ার্কে ডিভাইস শনাক্ত করার সংখ্যা।",
  "What does /24 mean?": "/24 এর মানে কী?",
  "The number after / is the network size (CIDR). Use /32 for one IPv4 computer, /128 for one IPv6 device, or /24 for a typical home/office IPv4 network.": "/-এর পরের সংখ্যা নেটওয়ার্কের আকার (CIDR) বোঝায়। একটি IPv4 কম্পিউটারের জন্য /32, একটি IPv6 ডিভাইসের জন্য /128, অথবা সাধারণ বাসা/অফিস IPv4 নেটওয়ার্কের জন্য /24 ব্যবহার করুন।",
  "For one computer": "একটি কম্পিউটারের জন্য",
  "Enter YOUR_IP/32 (replace YOUR_IP with the address you found) to allow only that computer.": "শুধু ওই কম্পিউটার অনুমোদন করতে YOUR_IP/32 লিখুন (YOUR_IP-এর জায়গায় পাওয়া ঠিকানাটি বসান)।",
  "Find your address": "আপনার ঠিকানা খুঁজুন",
  "Mac: System Settings → Wi‑Fi → Details, or run `ipconfig getifaddr en0`.": "Mac: System Settings → Wi‑Fi → Details দেখুন, অথবা `ipconfig getifaddr en0` চালান।",
  "Windows: open Command Prompt and run `ipconfig`.": "Windows: Command Prompt খুলে `ipconfig` চালান।",
  "Linux: run `hostname -I`.": "Linux: `hostname -I` চালান।",
  "Examples": "উদাহরণ",
  "One PC": "একটি PC",
  "Whole network": "পুরো নেটওয়ার্ক",
  "Use YOUR_IP/32 (replace with your own IP).": "YOUR_IP/32 ব্যবহার করুন (নিজের IP দিয়ে বদলান)।",
  "Use YOUR_NETWORK/CIDR (calculated from your IP and subnet mask).": "আপনার IP ও subnet mask থেকে হিসাব করা YOUR_NETWORK/CIDR ব্যবহার করুন।",
  "Public internet access": "পাবলিক ইন্টারনেট অ্যাক্সেস",
  "If people connect through the internet, enter your router's public IP with /32 (for example 103.213.238.138/32). Port forwarding must send traffic to this server.": "মানুষ ইন্টারনেট দিয়ে সংযোগ করলে রাউটারের পাবলিক IP-এর শেষে /32 লিখুন (যেমন 103.213.238.138/32)। Port forwarding-এ এই সার্ভারে ট্রাফিক পাঠাতে হবে।",
  "For people on the same Wi‑Fi, use their private LAN range instead (usually YOUR_NETWORK/24). A public IP does not replace the LAN range for local traffic.": "একই Wi‑Fi-এর মানুষের জন্য private LAN range ব্যবহার করুন (সাধারণত YOUR_NETWORK/24)। স্থানীয় ট্রাফিকের ক্ষেত্রে পাবলিক IP LAN range-এর বিকল্প নয়।",
  "Your network address is calculated from your IP and subnet mask; it is not always the same number.": "আপনার IP এবং subnet mask থেকে network address হিসাব হয়; এটি সবসময় একই সংখ্যা নয়।",
  "Example: IP 192.168.99.147 with mask 255.255.255.0 becomes 192.168.99.0/24.": "উদাহরণ: IP 192.168.99.147 এবং mask 255.255.255.0 হলে 192.168.99.0/24 হবে।",
  "Check the IP and subnet mask in your device's network details, then enter the calculated network address with its CIDR size.": "ডিভাইসের network details-এ IP ও subnet mask দেখুন, তারপর CIDR size-সহ হিসাব করা network address লিখুন।",
  "Step 1": "ধাপ ১",
  "Create the catalog structure": "ক্যাটালগ কাঠামো তৈরি করুন",
  "Create a category first, then add one or more sub-categories.":
    "প্রথমে ক্যাটাগরি তৈরি করুন, তারপর এক বা একাধিক সাব-ক্যাটাগরি যোগ করুন।",
  "New category": "নতুন ক্যাটাগরি",
  "Example: Professional Programs": "উদাহরণ: প্রফেশনাল প্রোগ্রাম",
  "Create category": "ক্যাটাগরি তৈরি করুন",
  Category: "ক্যাটাগরি",
  "Choose a category": "ক্যাটাগরি বেছে নিন",
  "New sub-category": "নতুন সাব-ক্যাটাগরি",
  "Example: Data Foundations": "উদাহরণ: ডেটা ফাউন্ডেশন",
  "Create sub-category": "সাব-ক্যাটাগরি তৈরি করুন",
  "No sub-categories yet": "এখনও সাব-ক্যাটাগরি নেই",
  "Step 2": "ধাপ ২",
  "Edit description": "বিবরণ সম্পাদনা করুন",
  "Add a description": "বিবরণ যোগ করুন",
  "Select the category and sub-category you created, then add the factual product description.":
    "তৈরি করা ক্যাটাগরি ও সাব-ক্যাটাগরি বেছে নিয়ে সঠিক প্রোডাক্ট বিবরণ যোগ করুন।",
  "Sub-category": "সাব-ক্যাটাগরি",
  "Choose a sub-category": "সাব-ক্যাটাগরি বেছে নিন",
  "Product description": "প্রোডাক্ট বিবরণ",
  "Add only factual information that the audit may verify.":
    "অডিটে যাচাই করা যাবে এমন সঠিক তথ্যই যোগ করুন।",
  "Update description": "বিবরণ আপডেট করুন",
  "Save description": "বিবরণ সেভ করুন",
  "Product descriptions": "প্রোডাক্ট বিবরণ",
  "Search descriptions": "বিবরণ খুঁজুন",
  Edit: "সম্পাদনা",
  Restore: "ফিরিয়ে আনুন",
  Archive: "আর্কাইভ",
  "Category created. You can now add its sub-categories.":
    "ক্যাটাগরি তৈরি হয়েছে। এখন সাব-ক্যাটাগরি যোগ করতে পারবেন।",
  "Sub-category created. It is now available in the description dropdown.":
    "সাব-ক্যাটাগরি তৈরি হয়েছে এবং বিবরণের dropdown-এ পাওয়া যাবে।",
  "Product description saved.": "প্রোডাক্ট বিবরণ সেভ হয়েছে।",
  "Existing description loaded. Update it below if needed.":
    "আগের বিবরণ লোড হয়েছে। প্রয়োজন হলে নিচে আপডেট করুন।",
  "Structured scorecard builder": "স্ট্রাকচার্ড স্কোরকার্ড বিল্ডার",
  "Edit scorecard": "স্কোরকার্ড সম্পাদনা",
  "Category weights and the overall total must reconcile exactly.":
    "ক্যাটাগরির স্কোর ও মোট স্কোর অবশ্যই সমান হতে হবে।",
  "Parameter name": "প্যারামিটারের নাম",
  "Overall total": "মোট স্কোর",
  "Category name": "ক্যাটাগরির নাম",
  "Category weight": "ক্যাটাগরির স্কোর",
  "Score row": "স্কোরের সারি",
  Weight: "স্কোর",
  "Add row": "সারি যোগ করুন",
  "Remove category": "ক্যাটাগরি মুছুন",
  "Add category": "ক্যাটাগরি যোগ করুন",
  "Critical-error rules (one per line)":
    "Critical-error নিয়ম (প্রতি লাইনে একটি)",
  "Update scorecard": "স্কোরকার্ড আপডেট করুন",
  "Save scorecard": "স্কোরকার্ড সেভ করুন",
  Scorecards: "স্কোরকার্ড",
  "Scorecard saved.": "স্কোরকার্ড সেভ হয়েছে।",
  Version: "ভার্সন",
  points: "পয়েন্ট",
  legacy: "পুরোনো",
  "Manage access and future audit configuration.":
    "অ্যাক্সেস ও ভবিষ্যৎ অডিট কনফিগারেশন পরিচালনা করুন।",
  Users: "ব্যবহারকারী",
  Products: "প্রোডাক্ট",
  "Admin sections": "অ্যাডমিন বিভাগ",
  "Authentication required.": "লগইন প্রয়োজন।",
  "Administrator access is required.": "অ্যাডমিন অনুমতি প্রয়োজন।",
  "Account was deactivated.": "অ্যাকাউন্টটি নিষ্ক্রিয় করা হয়েছে।",
  "This account is inactive.": "এই অ্যাকাউন্টটি নিষ্ক্রিয়।",
  "User was not found.": "ব্যবহারকারীকে পাওয়া যায়নি।",
  "Enter a valid email address.": "সঠিক ইমেইল দিন।",
  "Invalid email or password.": "ইমেইল বা পাসওয়ার্ড সঠিক নয়।",
  "Current password is incorrect.": "বর্তমান পাসওয়ার্ড সঠিক নয়।",
  "Password must be between 12 and 128 characters.":
    "পাসওয়ার্ড ১২ থেকে ১২৮ অক্ষরের হতে হবে।",
  "Password must not contain the username or email name.":
    "পাসওয়ার্ডে ইউজারনেম বা ইমেইলের নাম রাখা যাবে না।",
  "API key is required.": "API key প্রয়োজন।",
  "Enter a valid provider API key.": "সঠিক প্রোভাইডার API key দিন।",
  "The provider rejected this API key.": "প্রোভাইডার এই API key গ্রহণ করেনি।",
  "Category name is required.": "ক্যাটাগরির নাম প্রয়োজন।",
  "Category was not found.": "ক্যাটাগরি পাওয়া যায়নি।",
  "Sub-category was not found.": "সাব-ক্যাটাগরি পাওয়া যায়নি।",
  "Choose a category and sub-category, then add the description.":
    "ক্যাটাগরি ও সাব-ক্যাটাগরি বেছে নিয়ে বিবরণ যোগ করুন।",
  "Choose a valid category and sub-category.":
    "সঠিক ক্যাটাগরি ও সাব-ক্যাটাগরি বেছে নিন।",
  "Product brief was not found.": "প্রোডাক্ট বিবরণ পাওয়া যায়নি।",
  "Product fields cannot be empty.": "প্রোডাক্টের তথ্য খালি রাখা যাবে না।",
  "Company name is required.": "কোম্পানির নাম প্রয়োজন।",
  "Scorecard was not found.": "স্কোরকার্ড পাওয়া যায়নি।",
  "Scorecard category names must be unique.":
    "স্কোরকার্ডের ক্যাটাগরির নাম আলাদা হতে হবে।",
  "Scorecard name and at least one category are required.":
    "স্কোরকার্ডের নাম ও কমপক্ষে একটি ক্যাটাগরি প্রয়োজন।",
  "Every scorecard category and row needs a name and positive weight.":
    "প্রতিটি স্কোরকার্ড ক্যাটাগরি ও সারিতে নাম এবং শূন্যের বেশি স্কোর প্রয়োজন।",
  "Report was not found.": "রিপোর্ট পাওয়া যায়নি।",
  "Report history is temporarily unavailable.":
    "রিপোর্টের ইতিহাস সাময়িকভাবে পাওয়া যাচ্ছে না।",
  "The report is temporarily unavailable.":
    "রিপোর্টটি সাময়িকভাবে পাওয়া যাচ্ছে না।",
  "Change your temporary password before continuing.":
    "চালিয়ে যাওয়ার আগে অস্থায়ী পাসওয়ার্ড পরিবর্তন করুন।",
  "At least one active administrator is required.":
    "কমপক্ষে একজন সক্রিয় অ্যাডমিন থাকতে হবে।",
  "You cannot deactivate your own account.":
    "নিজের অ্যাকাউন্ট নিজে নিষ্ক্রিয় করতে পারবেন না।",
  "Use account settings to change your own password.":
    "নিজের পাসওয়ার্ড পরিবর্তন করতে অ্যাকাউন্ট সেটিংস ব্যবহার করুন।",
};

function useTr() {
  const language = useLanguage();
  return (text, values = {}) => {
    let output = language === "bn" ? bnCopy[text] || text : text;
    for (const [key, value] of Object.entries(values))
      output = output.replaceAll(`{${key}}`, value);
    return output;
  };
}

async function api(url, options = {}) {
  const { timeoutMs = 30000, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      credentials: "same-origin",
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        ...(fetchOptions.body ? { "Content-Type": "application/json" } : {}),
        ...(fetchOptions.headers || {}),
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(
        data.error || "The request could not be completed.",
      );
      error.status = response.status;
      error.code = data.errorCode;
      throw error;
    }
    return data;
  } catch (error) {
    if (error.name === "AbortError")
      throw new Error("The request timed out. Please try again.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
function body(method, value) {
  return { method, body: JSON.stringify(value) };
}
function Markdown({ value }) {
  return (
    <div
      className="report-content"
      dangerouslySetInnerHTML={{
        __html: DOMPurify.sanitize(marked.parse(value || "")),
      }}
    />
  );
}
function Notice({ message, error = false }) {
  const tr = useTr();
  return message ? (
    <div className={error ? "management-notice error" : "management-notice"}>
      {error ? <AlertTriangle size={16} /> : <Check size={16} />}
      {tr(message)}
    </div>
  ) : null;
}

export function SetupScreen({ onComplete }) {
  const tr = useTr();
  const [form, setForm] = useState({
    setupToken: "",
    email: "",
    username: "",
    password: "",
    companyName: "",
  });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await api("/api/setup", body("POST", form));
      onComplete();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-shell">
      <Card className="login-card setup-card">
        <CardHeader>
          <div className="setup-symbol">
            <ShieldCheck />
          </div>
          <CardTitle>{tr("Set up QA Auditor")}</CardTitle>
          <CardDescription>
            {tr(
              "Create the first administrator. The setup token comes from your server’s .env file and works only once.",
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="stack-form" onSubmit={submit}>
            <Label>{tr("Setup token")}</Label>
            <Input
              type="password"
              required
              value={form.setupToken}
              onChange={(e) => setForm({ ...form, setupToken: e.target.value })}
            />
            <div className="form-grid">
              <div>
                <Label>{tr("Email")}</Label>
                <Input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div>
                <Label>{tr("Username")}</Label>
                <Input
                  required
                  value={form.username}
                  onChange={(e) =>
                    setForm({ ...form, username: e.target.value })
                  }
                />
              </div>
            </div>
            <Label>{tr("Company name")}</Label>
            <Input
              required
              value={form.companyName}
              onChange={(e) =>
                setForm({ ...form, companyName: e.target.value })
              }
            />
            <Label>{tr("Password")}</Label>
            <Input
              type="password"
              minLength="12"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <small>
              {tr(
                "Use 12–128 characters and do not include the username or email name.",
              )}
            </small>
            <Notice message={message} error />
            <Button size="lg" disabled={busy}>
              {busy ? tr("Creating…") : tr("Create administrator")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export function PasswordChange({ forced = false, onChanged }) {
  const tr = useTr();
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirm: "",
  });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    if (form.newPassword !== form.confirm)
      return setMessage(tr("The new passwords do not match."));
    setBusy(true);
    setMessage("");
    try {
      await api("/api/account/password", body("PUT", form));
      onChanged?.();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }
  const content = (
    <form className="stack-form" onSubmit={submit}>
      <Label>{tr("Current password")}</Label>
      <Input
        type="password"
        autoComplete="current-password"
        required
        value={form.currentPassword}
        onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
      />
      <Label>{tr("New password")}</Label>
      <Input
        type="password"
        autoComplete="new-password"
        minLength="12"
        required
        value={form.newPassword}
        onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
      />
      <Label>{tr("Confirm new password")}</Label>
      <Input
        type="password"
        autoComplete="new-password"
        required
        value={form.confirm}
        onChange={(e) => setForm({ ...form, confirm: e.target.value })}
      />
      <Notice message={message} error />
      <Button disabled={busy}>
        {busy ? tr("Saving…") : tr("Change password")}
      </Button>
    </form>
  );
  if (!forced) return content;
  return (
    <div className="login-shell">
      <Card className="login-card">
        <CardHeader>
          <CardTitle>{tr("Set a private password")}</CardTitle>
          <CardDescription>
            {tr(
              "Your temporary password must be replaced before you can continue. Changing it signs out every device.",
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>{content}</CardContent>
      </Card>
    </div>
  );
}

export function AccountView({ user, onSignedOut }) {
  const tr = useTr();
  const [keys, setKeys] = useState(user.apiKeyStatus || {});
  const [provider, setProvider] = useState("gemini");
  const [apiKey, setApiKey] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function saveKey(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const data = await api(
        `/api/account/api-keys/${provider}`,
        { ...body("PUT", { apiKey }), timeoutMs: 15000 },
      );
      setKeys((current) => ({ ...current, [provider]: data.apiKey }));
      setApiKey("");
      setMessage(data.warning || tr("API key encrypted and saved."));
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }
  async function removeKey(name) {
    try {
      await api(`/api/account/api-keys/${name}`, { method: "DELETE" });
      setKeys((current) => ({ ...current, [name]: { configured: false } }));
      setMessage(tr("API key removed."));
    } catch (error) {
      setMessage(error.message);
    }
  }
  return (
    <Workspace
      title={tr("Account security")}
      subtitle={tr(
        "Manage your password and personal provider keys. Administrators cannot see these keys.",
      )}
    >
      <div className="management-grid two">
        <Card>
          <CardHeader>
            <CardTitle>
              <KeyRound size={18} /> {tr("Password")}
            </CardTitle>
            <CardDescription>
              {tr("Changing your password signs out every active device.")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PasswordChange onChanged={onSignedOut} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>
              <ShieldCheck size={18} /> {tr("API keys")}
            </CardTitle>
            <CardDescription>
              {tr("Keys are encrypted. Saved values are never shown again.")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="key-list">
              {["gemini", "openai"].map((name) => (
                <div className="key-row" key={name}>
                  <div>
                    <strong>
                      {name === "gemini" ? "Google Gemini" : "OpenAI"}
                    </strong>
                    <span>
                      {keys[name]?.configured
                        ? `•••• ${keys[name].lastFour} · ${keys[name].status || "saved"}`
                        : tr("Not configured")}
                    </span>
                  </div>
                  {keys[name]?.configured && (
                    <ConfirmDialog
                      trigger={
                        <Button variant="ghost" size="sm">
                          {tr("Remove")}
                        </Button>
                      }
                      title={`${tr("Remove")} ${name === "gemini" ? "Google Gemini" : "OpenAI"} API key?`}
                      description={tr(
                        "Audits using this provider will be unavailable until you add another key.",
                      )}
                      confirmLabel={tr("Remove key")}
                      destructive
                      onConfirm={() => removeKey(name)}
                    />
                  )}
                </div>
              ))}
            </div>
            <form className="stack-form compact" onSubmit={saveKey}>
              <Label>{tr("Provider")}</Label>
              <Select
                value={provider}
                onValueChange={setProvider}
                options={[
                  { value: "gemini", label: "Google Gemini" },
                  { value: "openai", label: "OpenAI" },
                ]}
              />
              <Label>{tr("New API key")}</Label>
              <Input
                type="password"
                required
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={tr("Paste a new key")}
              />
              <Notice
                message={message}
                error={/rejected|could not|invalid|timed out/i.test(message)}
              />
              <Button disabled={busy}>
                {busy ? tr("Checking…") : tr("Validate and save")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </Workspace>
  );
}

function Workspace({ title, subtitle, actions, children }) {
  return (
    <div className="workspace-view">
      <div className="workspace-heading">
        <div>
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}
function modeName(mode, tr = (text) => text) {
  return mode === "single"
    ? tr("QA scorecard")
    : mode === "voice"
      ? tr("Customer voice")
      : mode === "coaching"
        ? tr("Advisor coaching")
        : tr("Legacy report");
}
function dateText(value, language = "en") {
  try {
    return new Intl.DateTimeFormat(language === "bn" ? "bn-BD" : "en", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

export function ReportsView({ user, onNewAudit, summaryMode = false }) {
  const tr = useTr();
  const language = useLanguage();
  const today = new Date().toISOString().slice(0, 10);
  const [data, setData] = useState({ items: [], nextCursor: null, summary: {} });
  const [options, setOptions] = useState({ agents: [], processes: [], modes: [], owners: [] });
  const [reportTab, setReportTab] = useState(summaryMode ? "summary" : "reports");
  const [selectedIds, setSelectedIds] = useState([]);
  const [cursorHistory, setCursorHistory] = useState([""]);
  const [pageIndex, setPageIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [owners, setOwners] = useState([]);
  const [filters, setFilters] = useState({
    mode: [],
    search: "",
    ce: [],
    ownerUserId: [],
    parameter: [],
    agentName: [],
    process: [],
    from: `${today.slice(0, 8)}01`,
    to: today,
    minScore: "",
    maxScore: "",
  });
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");
  async function load(cursor = "", append = false) {
    setBusy(true);
    setMessage("");
    try {
      const params = new URLSearchParams({ limit: "20" });
      Object.entries(filters).forEach(
        ([key, value]) =>
          value && params.set(key, Array.isArray(value) ? value.join(",") : key === "to" ? `${value}T23:59:59` : value),
      );
      if (summaryMode || reportTab === "summary") params.set("mode", "single");
      if (cursor) params.set("cursor", cursor);
      const next = await api(`/api/reports?${params}`);
      setData((current) => ({
        items: append ? [...current.items, ...next.items] : next.items,
        nextCursor: next.nextCursor,
      }));
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (user.role === "admin")
      api("/api/admin/users")
        .then((value) => setOwners(value.users))
        .catch(() => {});
  }, [user.role]);
  useEffect(() => { api("/api/reports/options").then(setOptions).catch(() => {}); }, []);
  useEffect(() => {
    setCursorHistory([""]); setPageIndex(0);
    const timer = setTimeout(() => load(), 180);
    return () => clearTimeout(timer);
  }, [JSON.stringify(filters), reportTab, summaryMode]);
  async function openReport(id) {
    setBusy(true);
    try {
      const value = await api(`/api/reports/${id}`);
      setSelected(value.report);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }
  function downloadWord() {
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>QA Report</title></head><body>${DOMPurify.sanitize(marked.parse(selected?.report || ""))}</body></html>`;
    const url = URL.createObjectURL(
      new Blob(["\ufeff", html], { type: "application/msword" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `QA_Report_${new Date().toISOString().slice(0, 10)}.doc`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  if (selected)
    return (
      <Workspace
        title={tr("Report detail")}
        actions={
          <div className="form-actions">
            <Button variant="outline" onClick={() => setSelected(null)}>
              <ChevronLeft size={16} /> {tr("Back")}
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <FileDown size={15} /> PDF
            </Button>
            <Button variant="outline" onClick={downloadWord}>
              <FileText size={15} /> {tr("Word")}
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                navigator.clipboard?.writeText(selected.report || "")
              }
            >
              <Check size={15} /> {tr("Copy")}
            </Button>
            <Button onClick={onNewAudit}>
              <Plus size={15} /> {tr("New Audit")}
            </Button>
          </div>
        }
      >
        <Card className="history-detail">
          <CardHeader>
            <CardTitle>{modeName(selected.mode, tr)}</CardTitle>
            <CardDescription>
              {selected.ownerName || selected.ownerEmail} ·{" "}
              {dateText(selected.completedAt || selected.createdAt, language)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="report-facts">
              <span>
                {tr("Model")}
                <strong>{selected.model || tr("Not recorded")}</strong>
              </span>
              <span>
                {tr("Source")}
                <strong>{selected.cached ? tr("Cached") : tr("Fresh")}</strong>
              </span>
              <span>
                {tr("Company")}
                <strong>{selected.companySnapshot}</strong>
              </span>
              <span>
                {tr("Parameter")}
                <strong>{selected.parameterSnapshot || tr("Generic")}</strong>
              </span>
              {selected.reasoningEffort ? (
                <span>
                  {tr("Reasoning")}
                  <strong>{selected.reasoningEffort}</strong>
                </span>
              ) : null}
              {Number.isFinite(Number(selected.estimatedCostUsd)) ? (
                <span>
                  {tr("Estimated API cost")}
                  <strong>${Number(selected.estimatedCostUsd).toFixed(6)}</strong>
                </span>
              ) : null}
              {selected.evidenceCache ? (
                <span>
                  {tr("Evidence cache")}
                  <strong>
                    {selected.evidenceCache.hits || 0} {tr("hits")} ·{" "}
                    {selected.evidenceCache.misses || 0} {tr("misses")}
                  </strong>
                </span>
              ) : null}
            </div>
            {selected.items?.map((item, index) =>
              item.status === "success" ? (
                <section className="history-report" key={index}>
                  <h3>{item.fileName || modeName(item.kind, tr)}</h3>
                  <Markdown value={item.markdown} />
                </section>
              ) : (
                <Notice
                  key={index}
                  message={`${item.fileName || tr("Call failed")}: ${item.error}`}
                  error
                />
              ),
            )}
          </CardContent>
        </Card>
      </Workspace>
    );
  const isSummary = summaryMode || reportTab === "summary";
  return (
    <Workspace
      title={isSummary ? tr("Summary") : tr("Reports")}
      subtitle={isSummary ? tr("Select completed QA calls to create a clear coaching summary.") : user.role === "admin" ? tr("All completed audit and insight reports.") : tr("Your completed audit and insight reports.")}
      actions={
        <Button onClick={onNewAudit}>
          <Plus size={16} /> {tr("New Audit")}
        </Button>
      }
    >
      <Card>
        <CardContent className="report-filters">
          <div className="search-field">
            <Search size={16} />
            <Input
              aria-label={tr("Search filename, user, or text")}
              placeholder={tr("Search filename, user, or text")}
              value={filters.search}
              onChange={(e) =>
                setFilters({ ...filters, search: e.target.value })
              }
            />
          </div>
          <MultiSelect id="report-agents" value={filters.agentName} onChange={(agentName) => setFilters({ ...filters, agentName })} options={options.agents} placeholder={tr("All agents")} searchPlaceholder={tr("Search agents")} emptyText={tr("No results") } selectedText={tr("{count} selected")} clearText={tr("Clear selections")} />
          <MultiSelect id="report-processes" value={filters.process} onChange={(process) => setFilters({ ...filters, process })} options={options.processes} placeholder={tr("All processes")} searchPlaceholder={tr("Search processes")} emptyText={tr("No results") } selectedText={tr("{count} selected")} clearText={tr("Clear selections")} />
          <MultiSelect
            id="report-modes"
            aria-label={tr("Report mode")}
            value={isSummary ? ["single"] : filters.mode}
            placeholder={tr("All modes")}
            searchPlaceholder={tr("Search modes")}
            emptyText={tr("No results")}
            selectedText={tr("{count} selected")}
            clearText={tr("Clear selections")}
            onChange={(mode) => setFilters({ ...filters, mode })}
            options={[
              { value: "single", label: tr("QA scorecard") },
              { value: "voice", label: tr("Customer voice") },
              { value: "coaching", label: tr("Advisor coaching") },
            ]}
          />
          <MultiSelect
            aria-label={tr("CE status")}
            value={filters.ce}
            placeholder={tr("All CE statuses")}
            onChange={(ce) => setFilters({ ...filters, ce })}
            options={[
              { value: "true", label: tr("Has CE") },
              { value: "false", label: tr("Non-CE") },
            ]}
          />
          {(user.role === "admin" || user.role === "manager") && (
            <MultiSelect
              aria-label={tr("Report owner")}
              value={filters.ownerUserId}
              placeholder={tr("All users")}
              onChange={(ownerUserId) => setFilters({ ...filters, ownerUserId })}
              options={[
                ...owners.map((owner) => ({
                  value: owner.id,
                  label: owner.username,
                })),
              ]}
            />
          )}
          <Input
            aria-label={tr("Parameter")}
            placeholder={tr("Parameter")}
            value={filters.parameter}
            onChange={(e) =>
              setFilters({ ...filters, parameter: e.target.value })
            }
          />
          <DatePicker
            aria-label={tr("From date")}
            value={filters.from}
            onChange={(from) => setFilters({ ...filters, from })}
            placeholder={tr("From date")}
          />
          <DatePicker
            aria-label={tr("To date")}
            value={filters.to}
            onChange={(to) => setFilters({ ...filters, to })}
            placeholder={tr("To date")}
          />
          <Input
            aria-label={tr("Minimum score")}
            type="number"
            min="0"
            placeholder={tr("Min score")}
            value={filters.minScore}
            onChange={(e) =>
              setFilters({ ...filters, minScore: e.target.value })
            }
          />
          <Input
            aria-label={tr("Maximum score")}
            type="number"
            min="0"
            placeholder={tr("Max score")}
            value={filters.maxScore}
            onChange={(e) =>
              setFilters({ ...filters, maxScore: e.target.value })
            }
          />
        </CardContent>
      </Card>
      {!isSummary && <div className="report-metrics">
        <Card><CardContent><strong>{data.summary?.callsEvaluated || 0}</strong><span>{tr("Calls evaluated")}</span></CardContent></Card>
        <Card><CardContent><strong>{data.summary?.averageQaScore ?? "—"}</strong><span>{tr("Average QA score")}</span></CardContent></Card>
        <Card><CardContent><strong>{data.summary?.ahtSeconds != null ? `${Math.round(data.summary.ahtSeconds)}s` : "—"}</strong><span>{tr("AHT")}</span></CardContent></Card>
        <Card><CardContent><strong>{data.summary?.ceCount || 0}</strong><span>{tr("CE count")}</span></CardContent></Card>
      </div>}
      <Notice message={message} error />
      <div className="history-list report-table-wrap">
        <table className="report-table"><thead><tr>{isSummary && <th>Select</th>}<th>Timestamp</th><th>Mode</th><th>Agent</th><th>Process</th><th>Duration</th><th>Score</th><th>CE</th><th> </th></tr></thead><tbody>
        {data.items.map((item) => <tr key={item.id}>{isSummary && <td><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => setSelectedIds((ids) => ids.includes(item.id) ? ids.filter((id) => id !== item.id) : [...ids, item.id])} disabled={item.status !== "success"} /></td>}<td>{dateText(item.timestamp, language)}</td><td>{modeName(item.mode, tr)}</td><td>{item.agentName || "—"}</td><td>{item.process || "—"}</td><td>{item.durationSeconds != null ? `${Math.round(item.durationSeconds)}s` : "—"}</td><td>{item.score != null ? `${item.ce ? 0 : item.score}${item.maximum ? ` / ${item.maximum}` : ""}` : "—"}</td><td>{item.ce ? <span className="ce-badge">CE</span> : "—"}</td><td className="report-action-cell"><Button variant="ghost" size="icon" onClick={() => openReport(item.reportId)} aria-label="Open report"><Eye size={17} /></Button></td></tr>)}
        </tbody></table>
        {!busy && !data.items.length && (
          <div className="empty-state">
            <FileText />
            <strong>{tr("No reports yet")}</strong>
            <span>
              {tr("Completed audits and insight reports will appear here.")}
            </span>
          </div>
        )}
      </div>
      {isSummary && <div className="form-actions"><span>{selectedIds.length} selected</span><Button disabled={!selectedIds.length} onClick={async () => { setBusy(true); try { const value = await api("/api/report-summaries", { method: "POST", body: JSON.stringify({ recordIds: selectedIds }) }); setSelected(value.report); setSelectedIds([]); } catch (error) { setMessage(error.message); } finally { setBusy(false); } }}>{tr("Generate Summary")}</Button></div>}
      {busy && (
        <div className="inline-loading">
          <RefreshCw className="spin" /> {tr("Loading reports…")}
        </div>
      )}
      {!busy && <div className="form-actions pagination-actions"><Button variant="outline" disabled={pageIndex === 0} onClick={() => { const nextIndex = pageIndex - 1; setPageIndex(nextIndex); load(cursorHistory[nextIndex] || ""); }}>Previous</Button>{data.nextCursor && <Button variant="outline" onClick={() => { const nextIndex = pageIndex + 1; setCursorHistory((history) => [...history.slice(0, nextIndex), data.nextCursor]); setPageIndex(nextIndex); load(data.nextCursor); }}>Next</Button>}</div>}
    </Workspace>
  );
}

function UsersAdmin() {
  const tr = useTr();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ email: "", username: "", password: "" });
  const [reset, setReset] = useState({ userId: "", password: "" });
  const [message, setMessage] = useState("");
  async function load() {
    try {
      setUsers((await api("/api/admin/users")).users);
    } catch (error) {
      setMessage(error.message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function create(event) {
    event.preventDefault();
    try {
      await api("/api/admin/users", body("POST", form));
      setForm({ email: "", username: "", password: "" });
      setMessage(tr("User created with a temporary password."));
      load();
    } catch (error) {
      setMessage(error.message);
    }
  }
  async function update(user, action, value) {
    try {
      await api(
        `/api/admin/users/${user.id}/${action}`,
        body("PUT", { [action]: value }),
      );
      load();
    } catch (error) {
      setMessage(error.message);
    }
  }
  async function resetPassword(event, user) {
    event.preventDefault();
    try {
      await api(
        `/api/admin/users/${user.id}/reset-password`,
        body("POST", { temporaryPassword: reset.password }),
      );
      setReset({ userId: "", password: "" });
      setMessage(
        tr("Temporary password saved. Their existing sessions were revoked."),
      );
    } catch (error) {
      setMessage(error.message);
    }
  }
  return (
    <div className="management-grid two">
      <Card>
        <CardHeader>
          <CardTitle>
            <Plus size={18} /> {tr("Create user")}
          </CardTitle>
          <CardDescription>
            {tr("API keys are added privately by each user.")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="stack-form" onSubmit={create}>
            <Label>{tr("Email")}</Label>
            <Input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <Label>{tr("Username")}</Label>
            <Input
              required
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
            <Label>{tr("Temporary password")}</Label>
            <Input
              type="password"
              minLength="12"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <Button>{tr("Create user")}</Button>
            <Notice
              message={message}
              error={/required|found|use|least|could/i.test(message)}
            />
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>
            <UsersRound size={18} /> {tr("Accounts")}
          </CardTitle>
        </CardHeader>
        <CardContent className="admin-list">
          {users.map((user) => (
            <React.Fragment key={user.id}>
              <div className="admin-row">
                <div>
                  <strong>{user.username}</strong>
                  <span>{user.email}</span>
                </div>
                <Select
                  value={user.role}
                  aria-label={`Role for ${user.username}`}
                  className="role-select"
                  onValueChange={(role) => update(user, "role", role)}
                  options={[
                    { value: "user", label: tr("User") },
                    { value: "manager", label: tr("Manager") },
                    { value: "admin", label: tr("Admin") },
                  ]}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    update(
                      user,
                      "status",
                      user.status === "active" ? "inactive" : "active",
                    )
                  }
                >
                  {user.status === "active"
                    ? tr("Deactivate")
                    : tr("Reactivate")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setReset({ userId: user.id, password: "" })}
                >
                  {tr("Reset password")}
                </Button>
              </div>
              {reset.userId === user.id && (
                <form
                  className="inline-reset"
                  onSubmit={(event) => resetPassword(event, user)}
                >
                  <Input
                    aria-label={`Temporary password for ${user.username}`}
                    type="password"
                    minLength="12"
                    required
                    value={reset.password}
                    onChange={(event) =>
                      setReset({ ...reset, password: event.target.value })
                    }
                  />
                  <Button size="sm">{tr("Save temporary password")}</Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setReset({ userId: "", password: "" })}
                  >
                    {tr("Cancel")}
                  </Button>
                </form>
              )}
            </React.Fragment>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function CompanyAdmin() {
  const tr = useTr();
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    api("/api/admin/company")
      .then((value) => setName(value.companyName))
      .catch((error) => setMessage(error.message));
  }, []);
  async function save(event) {
    event.preventDefault();
    try {
      await api("/api/admin/company", body("PUT", { companyName: name }));
      setMessage(tr("Company name saved for future reports."));
    } catch (error) {
      setMessage(error.message);
    }
  }
  return (
    <Card className="narrow-card">
      <CardHeader>
        <CardTitle>{tr("Company name")}</CardTitle>
        <CardDescription>
          Historical reports keep their original company snapshot.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="stack-form" onSubmit={save}>
          <Label>{tr("Company name")}</Label>
          <Input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button>{tr("Save company")}</Button>
          <Notice message={message} error={/could|required/i.test(message)} />
        </form>
      </CardContent>
    </Card>
  );
}

function NetworkAccessAdmin() {
  const tr = useTr();
  const [enabled, setEnabled] = useState(true); const [ipv4, setIpv4] = useState([]); const [ipv6, setIpv6] = useState([]); const [message, setMessage] = useState("");
  useEffect(() => { api("/api/admin/network-access").then(({ networkAccess }) => { setEnabled(networkAccess.enabled !== false); setIpv4((networkAccess.ipv4Rules || (networkAccess.ipv4 || []).map(value => ({ value, selected: true }))).map(row => ({ value: String(row.value || row.address || ""), selected: row.selected !== false }))); setIpv6((networkAccess.ipv6Rules || (networkAccess.ipv6 || []).map(value => ({ value, selected: true }))).map(row => ({ value: String(row.value || row.address || ""), selected: row.selected !== false }))); }).catch(error => setMessage(error.message)); }, []);
  function addRow(setter) { setter(rows => [...rows, { value: "", selected: true }]); }
  function removeRow(setter, index) { setter(rows => rows.filter((_, rowIndex) => rowIndex !== index)); }
  function toggleRow(family, index) { const rows = family === "ipv4" ? ipv4 : ipv6; const row = rows[index]; if (!row) return; if (row.selected && (row.value === "0.0.0.0/0" || row.value === "::/0")) { const otherSelected = [...ipv4, ...ipv6].some(item => item.selected && item.value && !(item.value === "0.0.0.0/0" || item.value === "::/0")); if (!otherSelected) { setMessage(tr("Add and select another address before disabling wildcard access.")); return; } if (!window.confirm(tr("Disabling wildcard access may block users outside the selected addresses. Continue?"))) return; } const setter = family === "ipv4" ? setIpv4 : setIpv6; setter(items => items.map((item, itemIndex) => itemIndex === index ? { ...item, selected: !item.selected } : item)); }
  async function save(event) { event.preventDefault(); try { await api("/api/admin/network-access", body("PUT", { enabled, ipv4Entries: ipv4, ipv6Entries: ipv6 })); setMessage(tr("Network policy saved.")); } catch (error) { setMessage(error.message); } }
  const table = (label, rows, setter, family) => <div className="network-rule-group"><div className="network-rule-heading"><Label>{label}</Label><Button type="button" variant="outline" size="icon" onClick={() => addRow(setter)} aria-label={tr("Add address")}><Plus size={16} /></Button></div><div className="network-rule-table"><div className="network-rule-header"><span>{tr("Use")}</span><span>{tr("Address or CIDR")}</span><span aria-hidden="true" /></div>{rows.map((row, index) => <div className="network-rule-row" key={`${family}-${index}`}><input type="checkbox" checked={row.selected} onChange={() => toggleRow(family, index)} aria-label={`${tr("Use")} ${row.value || tr("address")}`} /><Input value={row.value} placeholder={family === "ipv4" ? "0.0.0.0/0" : "::/0"} onChange={event => setter(items => items.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item))} /><Button type="button" variant="ghost" size="icon" onClick={() => removeRow(setter, index)} aria-label={tr("Remove address")}><Trash2 size={15} /></Button></div>)}</div></div>;
  return <div className="network-access-layout"><Card className="narrow-card"><CardHeader><CardTitle>{tr("Network access")}</CardTitle><CardDescription>{tr("This policy protects the entire application. Keep your current address allowed before saving.")}</CardDescription></CardHeader><CardContent><form className="stack-form" onSubmit={save}><label className="switch-row"><input type="checkbox" checked={!enabled} onChange={event => setEnabled(!event.target.checked)} /><span>{tr("Allow all networks")}</span></label>{table(tr("Allowed IPv4 ranges"), ipv4, setIpv4, "ipv4")}{table(tr("Allowed IPv6 ranges"), ipv6, setIpv6, "ipv6")}<small>{tr("Select the rows that should be allowed. Wildcards are selected by default.")}</small><Button>{tr("Save network policy")}</Button><Notice message={message} error={/could|required|valid|current|disabling|another/i.test(message)} /></form></CardContent></Card><Card className="network-help-card"><CardHeader><CardTitle>{tr("How to fill this")}</CardTitle><CardDescription>{tr("An IP address is the number that identifies a device on your network.")}</CardDescription></CardHeader><CardContent><h3>{tr("What does /24 mean?")}</h3><p>{tr("The number after / is the network size (CIDR). Use /32 for one IPv4 computer, /128 for one IPv6 device, or /24 for a typical home/office IPv4 network.")}</p><h3>{tr("For one computer")}</h3><p>{tr("Enter YOUR_IP/32 (replace YOUR_IP with the address you found) to allow only that computer.")}</p><h3>{tr("Public internet access")}</h3><p>{tr("If people connect through the internet, enter your router's public IP with /32 (for example 103.213.238.138/32). Port forwarding must send traffic to this server.")}</p><p>{tr("For people on the same Wi‑Fi, use their private LAN range instead (usually YOUR_NETWORK/24). A public IP does not replace the LAN range for local traffic.")}</p><p>{tr("Your network address is calculated from your IP and subnet mask; it is not always the same number.")}</p><p>{tr("Check the IP and subnet mask in your device's network details, then enter the calculated network address with its CIDR size.")}</p><h3>{tr("Find your address")}</h3><p>{tr("Mac: System Settings → Wi‑Fi → Details, or run `ipconfig getifaddr en0`.")}</p><p>{tr("Windows: open Command Prompt and run `ipconfig`.")}</p><p>{tr("Linux: run `hostname -I`.")}</p><h3>{tr("Examples")}</h3><p><strong>{tr("One PC")}:</strong> {tr("Use YOUR_IP/32 (replace with your own IP).")}</p><p><strong>{tr("Whole network")}:</strong> {tr("Use YOUR_NETWORK/CIDR (calculated from your IP and subnet mask).")}</p><p>{tr("Example: IP 192.168.99.147 with mask 255.255.255.0 becomes 192.168.99.0/24.")}</p></CardContent></Card></div>;
}

function ProductsAdmin() {
  const tr = useTr();
  const emptyBrief = { categoryId: "", subCategoryId: "", brief: "" };
  const [taxonomy, setTaxonomy] = useState([]);
  const [items, setItems] = useState([]);
  const [categoryName, setCategoryName] = useState("");
  const [subCategoryForm, setSubCategoryForm] = useState({
    categoryId: "",
    name: "",
  });
  const [form, setForm] = useState(emptyBrief);
  const [editId, setEditId] = useState("");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const [taxonomyData, briefData] = await Promise.all([
      api("/api/admin/product-taxonomy"),
      api("/api/admin/product-briefs"),
    ]);
    setTaxonomy(taxonomyData.categories || []);
    setItems(briefData.items || []);
  }
  useEffect(() => {
    load().catch((error) => setMessage(error.message));
  }, []);

  const activeCategories = taxonomy.filter((item) => !item.archived);
  const selectedCategory = taxonomy.find((item) => item.id === form.categoryId);
  const availableSubCategories = (selectedCategory?.subCategories || []).filter(
    (item) => !item.archived,
  );

  async function createCategory(event) {
    event.preventDefault();
    try {
      await api(
        "/api/admin/product-categories",
        body("POST", { name: categoryName }),
      );
      setCategoryName("");
      setMessage(tr("Category created. You can now add its sub-categories."));
      await load();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function createSubCategory(event) {
    event.preventDefault();
    try {
      await api(
        "/api/admin/product-subcategories",
        body("POST", subCategoryForm),
      );
      setSubCategoryForm({ categoryId: subCategoryForm.categoryId, name: "" });
      setMessage(
        tr(
          "Sub-category created. It is now available in the description dropdown.",
        ),
      );
      await load();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function saveBrief(event) {
    event.preventDefault();
    try {
      if (editId)
        await api(`/api/admin/product-briefs/${editId}`, body("PUT", form));
      else await api("/api/admin/product-briefs", body("POST", form));
      setForm(emptyBrief);
      setEditId("");
      setMessage(tr("Product description saved."));
      await load();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function archive(item) {
    try {
      await api(
        `/api/admin/product-briefs/${item.id}`,
        body("PUT", { archived: !item.archived }),
      );
      await load();
    } catch (error) {
      setMessage(error.message);
    }
  }

  function edit(item) {
    setEditId(item.id);
    setForm({
      categoryId: String(item.categoryId || ""),
      subCategoryId: String(item.subCategoryId || ""),
      brief: item.brief,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function selectCategory(categoryId) {
    setEditId("");
    setForm({ categoryId, subCategoryId: "", brief: "" });
    setMessage("");
  }

  function selectSubCategory(subCategoryId) {
    const existing = items.find(
      (item) =>
        String(item.categoryId) === String(form.categoryId) &&
        String(item.subCategoryId) === String(subCategoryId),
    );
    setEditId(existing?.id || "");
    setForm({
      categoryId: form.categoryId,
      subCategoryId,
      brief: existing?.brief || "",
    });
    setMessage(
      existing
        ? tr("Existing description loaded. Update it below if needed.")
        : "",
    );
  }

  const visible = items.filter((item) =>
    `${item.category} ${item.subCategory} ${item.brief}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  return (
    <div className="product-admin">
      <div className="management-grid two">
        <Card>
          <CardHeader>
            <div className="step-label">{tr("Step 1")}</div>
            <CardTitle>{tr("Create the catalog structure")}</CardTitle>
            <CardDescription>
              {tr(
                "Create a category first, then add one or more sub-categories.",
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="catalog-setup">
            <form className="stack-form" onSubmit={createCategory}>
              <Label>{tr("New category")}</Label>
              <div className="inline-create">
                <Input
                  required
                  value={categoryName}
                  onChange={(event) => setCategoryName(event.target.value)}
                  placeholder={tr("Example: Professional Programs")}
                />
                <Button>{tr("Create category")}</Button>
              </div>
            </form>
            <form className="stack-form" onSubmit={createSubCategory}>
              <Label>{tr("Category")}</Label>
              <Select
                value={subCategoryForm.categoryId}
                placeholder={tr("Choose a category")}
                onValueChange={(categoryId) =>
                  setSubCategoryForm({
                    ...subCategoryForm,
                    categoryId,
                  })
                }
                options={activeCategories.map((category) => ({
                  value: category.id,
                  label: category.name,
                }))}
              />
              <Label>{tr("New sub-category")}</Label>
              <div className="inline-create">
                <Input
                  required
                  value={subCategoryForm.name}
                  onChange={(event) =>
                    setSubCategoryForm({
                      ...subCategoryForm,
                      name: event.target.value,
                    })
                  }
                  placeholder={tr("Example: Data Foundations")}
                />
                <Button disabled={!subCategoryForm.categoryId}>
                  {tr("Create sub-category")}
                </Button>
              </div>
            </form>
            <div className="taxonomy-preview">
              {taxonomy.map((category) => (
                <div key={category.id}>
                  <strong>{category.name}</strong>
                  <span>
                    {category.subCategories
                      ?.map((item) => item.name)
                      .join(", ") || tr("No sub-categories yet")}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="step-label">{tr("Step 2")}</div>
            <CardTitle>
              {editId ? tr("Edit description") : tr("Add a description")}
            </CardTitle>
            <CardDescription>
              {tr(
                "Select the category and sub-category you created, then add the factual product description.",
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="stack-form" onSubmit={saveBrief}>
              <Label>{tr("Category")}</Label>
              <Select
                value={form.categoryId}
                placeholder={tr("Choose a category")}
                onValueChange={selectCategory}
                options={activeCategories.map((category) => ({
                  value: category.id,
                  label: category.name,
                }))}
              />
              <Label>{tr("Sub-category")}</Label>
              <Select
                disabled={!form.categoryId}
                value={form.subCategoryId}
                placeholder={tr("Choose a sub-category")}
                onValueChange={selectSubCategory}
                options={availableSubCategories.map((subCategory) => ({
                  value: subCategory.id,
                  label: subCategory.name,
                }))}
              />
              <Label>{tr("Product description")}</Label>
              <Textarea
                rows="9"
                required
                value={form.brief}
                onChange={(event) =>
                  setForm({ ...form, brief: event.target.value })
                }
                placeholder={tr(
                  "Add only factual information that the audit may verify.",
                )}
              />
              <div className="form-actions">
                <Button disabled={!form.categoryId || !form.subCategoryId}>
                  {editId ? tr("Update description") : tr("Save description")}
                </Button>
                {editId && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setEditId("");
                      setForm(emptyBrief);
                    }}
                  >
                    {tr("Cancel")}
                  </Button>
                )}
              </div>
              <Notice
                message={message}
                error={/required|exist|valid|could|choose/i.test(message)}
              />
            </form>
          </CardContent>
        </Card>
      </div>

      <Card className="product-description-list">
        <CardHeader>
          <CardTitle>{tr("Product descriptions")}</CardTitle>
          <div className="search-field">
            <Search size={16} />
            <Input
              placeholder={tr("Search descriptions")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="admin-list">
          {visible.map((item) => (
            <div
              className={`catalog-row ${item.archived ? "archived" : ""}`}
              key={item.id}
            >
              <div>
                <strong>
                  {item.category} · {item.subCategory}
                </strong>
                <span>{item.brief}</span>
              </div>
              <Button variant="outline" size="sm" onClick={() => edit(item)}>
                {tr("Edit")}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => archive(item)}>
                <Archive size={14} />
                {item.archived ? tr("Restore") : tr("Archive")}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
function ScorecardsAdmin() {
  const tr = useTr();
  const newDefinition = () => ({
    name: "",
    overallTotal: 100,
    criticalErrors: "",
    categories: [
      {
        name: "",
        weight: 100,
        rows: [{ name: "", weight: 100 }],
      },
    ],
  });
  const [form, setForm] = useState(newDefinition);
  const [items, setItems] = useState([]);
  const [editId, setEditId] = useState("");
  const [message, setMessage] = useState("");
  async function load() {
    setItems((await api("/api/admin/scorecards")).items);
  }
  useEffect(() => {
    load().catch((error) => setMessage(error.message));
  }, []);
  function setCategory(index, field, value) {
    setForm((current) => ({
      ...current,
      categories: current.categories.map((category, i) =>
        i === index ? { ...category, [field]: value } : category,
      ),
    }));
  }
  function setRow(categoryIndex, rowIndex, field, value) {
    setForm((current) => ({
      ...current,
      categories: current.categories.map((category, i) =>
        i === categoryIndex
          ? {
              ...category,
              rows: category.rows.map((row, j) =>
                j === rowIndex ? { ...row, [field]: value } : row,
              ),
            }
          : category,
      ),
    }));
  }
  async function save(event) {
    event.preventDefault();
    try {
      await api(
        editId ? `/api/admin/scorecards/${editId}` : "/api/admin/scorecards",
        body(editId ? "PUT" : "POST", {
          name: form.name,
          definition: {
            overallTotal: Number(form.overallTotal),
            criticalErrors: form.criticalErrors
              .split("\n")
              .map((v) => v.trim())
              .filter(Boolean),
            categories: form.categories.map((category) => ({
              name: category.name,
              weight: Number(category.weight),
              rows: category.rows.map((row) => ({
                name: row.name,
                weight: Number(row.weight),
              })),
            })),
          },
        }),
      );
      setForm(newDefinition());
      setEditId("");
      setMessage(tr("Scorecard saved."));
      load();
    } catch (error) {
      setMessage(error.message);
    }
  }
  async function archive(item) {
    await api(
      `/api/admin/scorecards/${item.id}`,
      body("PUT", { archived: !item.archived }),
    );
    load();
  }
  function edit(item) {
    const definition = item.definition || {};
    setEditId(item.id);
    setForm({
      name: item.name,
      overallTotal: definition.overallTotal || definition.total || 100,
      criticalErrors: (definition.criticalErrors || []).join("\n"),
      categories: (definition.categories || []).map((category) => ({
        name: category.name,
        weight:
          category.weight ||
          (category.rows || []).reduce(
            (sum, row) => sum + Number(row.weight || 0),
            0,
          ),
        rows: category.rows || [],
      })),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  return (
    <div className="management-grid scorecard-grid">
      <Card>
        <CardHeader>
          <CardTitle>
            {editId ? tr("Edit scorecard") : tr("Structured scorecard builder")}
          </CardTitle>
          <CardDescription>
            {tr(
              "Category weights and the overall total must reconcile exactly.",
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="stack-form" onSubmit={save}>
            <div className="form-grid">
              <div>
                <Label>{tr("Parameter name")}</Label>
                <Input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <Label>{tr("Overall total")}</Label>
                <Input
                  type="number"
                  min="1"
                  required
                  value={form.overallTotal}
                  onChange={(e) =>
                    setForm({ ...form, overallTotal: e.target.value })
                  }
                />
              </div>
            </div>
            {form.categories.map((category, categoryIndex) => (
              <div className="builder-category" key={categoryIndex}>
                <div className="form-grid">
                  <Input
                    aria-label={tr("Category name")}
                    placeholder={tr("Category name")}
                    required
                    value={category.name}
                    onChange={(e) =>
                      setCategory(categoryIndex, "name", e.target.value)
                    }
                  />
                  <Input
                    aria-label={tr("Category weight")}
                    type="number"
                    min="1"
                    placeholder={tr("Weight")}
                    required
                    value={category.weight}
                    onChange={(e) =>
                      setCategory(categoryIndex, "weight", e.target.value)
                    }
                  />
                </div>
                {category.rows.map((row, rowIndex) => (
                  <div className="builder-row" key={rowIndex}>
                    <Input
                      aria-label={tr("Score row")}
                      placeholder={tr("Score row")}
                      required
                      value={row.name}
                      onChange={(e) =>
                        setRow(categoryIndex, rowIndex, "name", e.target.value)
                      }
                    />
                    <Input
                      aria-label={tr("Weight")}
                      type="number"
                      min="1"
                      required
                      value={row.weight}
                      onChange={(e) =>
                        setRow(
                          categoryIndex,
                          rowIndex,
                          "weight",
                          e.target.value,
                        )
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setCategory(
                          categoryIndex,
                          "rows",
                          category.rows.filter((_, i) => i !== rowIndex),
                        )
                      }
                    >
                      {tr("Remove")}
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCategory(categoryIndex, "rows", [
                      ...category.rows,
                      { name: "", weight: 1 },
                    ])
                  }
                >
                  <Plus size={14} /> {tr("Add row")}
                </Button>
                {form.categories.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        categories: current.categories.filter(
                          (_, index) => index !== categoryIndex,
                        ),
                      }))
                    }
                  >
                    {tr("Remove category")}
                  </Button>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setForm((current) => ({
                  ...current,
                  categories: [
                    ...current.categories,
                    { name: "", weight: 1, rows: [{ name: "", weight: 1 }] },
                  ],
                }))
              }
            >
              <Plus size={15} /> {tr("Add category")}
            </Button>
            <Label>{tr("Critical-error rules (one per line)")}</Label>
            <Textarea
              rows="5"
              value={form.criticalErrors}
              onChange={(e) =>
                setForm({ ...form, criticalErrors: e.target.value })
              }
            />
            <Notice
              message={message}
              error={/must|required|exist|duplicate|positive/i.test(message)}
            />
            <div className="form-actions">
              <Button>
                {editId ? tr("Update scorecard") : tr("Save scorecard")}
              </Button>
              {editId && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setEditId("");
                    setForm(newDefinition());
                  }}
                >
                  {tr("Cancel")}
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{tr("Scorecards")}</CardTitle>
        </CardHeader>
        <CardContent className="admin-list">
          {items.map((item) => (
            <div
              className={`catalog-row ${item.archived ? "archived" : ""}`}
              key={item.id}
            >
              <div>
                <strong>{item.name}</strong>
                <span>
                  {tr("Version")} {item.version || 1} ·{" "}
                  {item.definition?.overallTotal || tr("legacy")} {tr("points")}
                </span>
              </div>
              <Button variant="outline" size="sm" onClick={() => edit(item)}>
                {tr("Edit")}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => archive(item)}>
                <Archive size={14} />
                {item.archived ? tr("Restore") : tr("Archive")}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export function AdminView({ initialTab = "users", onTabChange }) {
  const tr = useTr();
  const [tab, setTab] = useState(initialTab);
  function changeTab(next) { setTab(next); onTabChange?.(next); }
  const views = {
    users: <UsersAdmin />,
    company: <CompanyAdmin />,
    network: <NetworkAccessAdmin />,
    products: <ProductsAdmin />,
    scorecards: <ScorecardsAdmin />,
  };
  return (
    <Workspace
      title={tr("Admin")}
      subtitle={tr("Manage access and future audit configuration.")}
    >
      <Tabs value={tab} onValueChange={changeTab}>
        <TabsList className="subnav" aria-label={tr("Admin sections")}>
          {[
            ["users", tr("Users")],
            ["company", tr("Company")],
            ["network", tr("Network access")],
            ["products", tr("Products")],
            ["scorecards", tr("Scorecards")],
          ].map(([value, label]) => (
            <TabsTrigger key={value} value={value}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        {Object.entries(views).map(([value, content]) => (
          <TabsContent key={value} value={value}>
            {content}
          </TabsContent>
        ))}
      </Tabs>
    </Workspace>
  );
}
