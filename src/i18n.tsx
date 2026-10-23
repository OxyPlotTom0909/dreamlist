import { getLocales } from "expo-localization";
import { Picker as NativePicker } from "@react-native-picker/picker";
import NativeDateTimePicker from "@react-native-community/datetimepicker";
import { Children, type ComponentProps, type ReactNode } from "react";
import {
  Alert as NativeAlert,
  Pressable as NativePressable,
  Text as NativeText,
  TextInput as NativeTextInput,
} from "react-native";

type AppLanguage = "zh-Hant" | "en";
export type LanguagePreference = "system" | AppLanguage;

const TRADITIONAL_CHINESE_REGIONS = new Set(["TW", "CN", "HK", "MO"]);
const deviceLocale = getLocales()[0];
const languageCode = deviceLocale?.languageCode?.toLowerCase() ?? "";
const regionCode = deviceLocale?.regionCode?.toUpperCase() ?? "";

const detectedLanguage: AppLanguage =
  languageCode === "zh" || TRADITIONAL_CHINESE_REGIONS.has(regionCode)
    ? "zh-Hant"
    : "en";
export let appLanguage: AppLanguage = detectedLanguage;
export let appLocale = appLanguage === "zh-Hant" ? "zh-TW" : "en-US";

export function applyLanguagePreference(preference: LanguagePreference): void {
  appLanguage = preference === "system" ? detectedLanguage : preference;
  appLocale = appLanguage === "zh-Hant" ? "zh-TW" : "en-US";
}

const english: Readonly<Record<string, string>> = {
  下一步: "Next",
  不動產: "Real estate",
  "了解負債狀況，才能更有規劃地走向未來。":
    "Understand your liabilities to plan your future with confidence.",
  你可支配的資源: "Resources you can use",
  你將刪除這筆資料: "You are about to delete this record",
  你的財務摘要: "Your financial summary",
  使用者: "User",
  使用者名稱: "User name",
  使用者設定: "User settings",
  信用卡: "Credit card",
  信用卡負債: "Credit card debt",
  信用卡還款: "Credit card payment",
  修改: "Edit",
  "修改後會立即更新資產負債表。":
    "Changes update the balance sheet immediately.",
  修改提醒: "Edit reminder",
  個: "",
  個人權益: "Personal equity",
  "個人權益足以讓進度達到 100% 後即可執行。":
    "You can proceed once your personal equity covers 100% of this goal.",
  備註: "Note",
  儲存設定: "Save settings",
  儲存變更: "Save changes",
  其他負債: "Other liabilities",
  其他資產: "Other assets",
  "列出你擁有的資產，幫助你掌握財務全貌。":
    "List what you own to understand your full financial picture.",
  刪除: "Delete",
  刪除失敗: "Could not delete",
  "刪除後日曆也不會再顯示這個固定項目。":
    "This recurring item will also stop appearing in the calendar.",
  "刪除後無法復原，相關卡片訊息也會同步調整。":
    "This cannot be undone, and related cards will be updated.",
  "刪除後無法復原，相關的財務金額也會同步調整。":
    "This cannot be undone, and related financial amounts will be updated.",
  "刪除後無法復原，資產負債表也會同步調整。":
    "This cannot be undone, and the balance sheet will be updated.",
  "刪除後，手機上的每月通知也會一併取消。":
    "The monthly notification on this device will also be cancelled.",
  刪除本機資料: "Delete local data",
  刪除這個夢想: "Delete this dream",
  刪除這筆記錄: "Delete this record",
  刪除這筆財務項目: "Delete this financial item",
  "加入一張代表夢想的圖片，讓目標更有感。":
    "Add an image that makes your dream feel real.",
  "加油，你的目標不遠了": "Keep going—you're close to your goal!",
  "加油，再接再勵": "Keep going and try again!",
  取消: "Cancel",
  名稱: "Name",
  "名稱可能已經存在。": "This name may already exist.",
  "哇，你真棒，你可以進行這個夢想了":
    "Amazing! You can make this dream happen now.",
  固定支出: "Recurring expenses",
  固定收入: "Recurring income",
  固定金額: "Recurring amount",
  執行: "Complete dream",
  "增加夢想清單（暫未開放）": "Add dream list (coming soon)",
  夢想: "Dreams",
  夢想清單: "Dream List",
  夢想列表: "Dream list",
  夢想名稱: "Dream name",
  夢想圖片: "Dream image",
  夢想提撥: "Dream contribution",
  夢想未來記帳本: "Aimmora",
  夢想進度: "Dream progress",
  "太棒了！你可以到完成清單回顧已執行的目標。":
    "Great work! Review your completed goals in the completed list.",
  完成: "Done",
  完成於: "Completed on",
  完成清單記錄: "Completed dreams",
  "完成盤點！這是你目前的財務狀況。":
    "Review complete! Here is your current financial position.",
  尚未建立: "Not set",
  尚未設定提醒: "No reminders yet",
  平台權限管理: "Platform permissions",
  年: "Year",
  建立夢想: "Create dream",
  "建立每月固定發送的裝置提醒。":
    "Create a recurring monthly device notification.",
  "建立第一個目標，開始安排你的資源與預算。":
    "Create your first goal and start planning your resources.",
  從相簿選擇圖片: "Choose from photos",
  我的: "Profile",
  我的每月固定支出: "My recurring monthly expenses",
  我的每月固定收入: "My recurring monthly income",
  我的資源: "My resources",
  房貸: "Mortgage",
  所有夢想都已經執行: "All dreams have been completed",
  所有資料只保存在本裝置內: "All data stays on this device",
  "打造實現夢想的計畫。": "Build a plan to make your dreams real.",
  "打開 App 看看你的夢想與財務進度吧！":
    "Open Aimmora to review your dream and financial progress.",
  投資: "Investments",
  "按下執行後，將記錄現在的時間並移到完成清單。":
    "Completing this dream records the current time and moves it to the completed list.",
  提醒內容: "Notification message",
  提醒通知: "Notifications",
  提醒項目: "Reminder type",
  支出: "Expense",
  支出方式: "Payment method",
  支出詳細內容: "Expense details",
  支出類別: "Expense categories",
  收入: "Income",
  收入詳細內容: "Income details",
  收入類別: "Income categories",
  "收入／支出分類": "Income / expense category",
  收支日曆: "Income & expense calendar",
  收藏每一個已經執行的夢想: "A collection of every dream you completed",
  新增: "Add",
  新增夢想: "Add dream",
  新增提醒: "Add reminder",
  新增收支項目: "Add transaction",
  新增財務項目: "Add financial item",
  "新增後會立即更新資產負債表。": "The balance sheet updates immediately.",
  日: "Day",
  "日・": " · ",
  日曆: "Calendar",
  日期: "Date",
  "是否要執行這個夢想？": "Are you ready to complete this dream?",
  時間: "Time",
  "暫時沒有的項目可填 0；之後可隨時回來調整。":
    "Enter 0 for items you do not have. You can update them later.",
  更換圖片: "Change image",
  "最多可建立 3 個夢想清單，此功能目前暫時關閉。":
    "You can create up to 3 dream lists. This feature is currently unavailable.",
  "製作中...，敬請期待": "Coming soon... Stay tuned!",
  "最後更新：2026 年 10 月 19 日・版本 1.1":
    "Last updated: October 19, 2026 · Version 1.1",
  月: "Month",
  有財務力量: "with financial power",
  "未選擇日期時，將依每月投入金額估算達成時間。":
    "Without a date, the completion time is estimated from your monthly contribution.",
  "查看完整隱私權政策 ↗": "View full privacy policy ↗",
  查看財務摘要: "View financial summary",
  標題: "Title",
  每月: "Monthly",
  每月分配給這個夢想: "Monthly contribution to this dream",
  每月固定支出: "Monthly recurring expenses",
  每月固定支出總和: "Total recurring monthly expenses",
  每月固定支出總計: "Total recurring monthly expenses",
  每月固定收入: "Monthly recurring income",
  每月固定收入總和: "Total recurring monthly income",
  每月固定收入總計: "Total recurring monthly income",
  每月固定收支總和: "Monthly recurring totals",
  每月提醒: "Monthly reminder",
  每月結餘: "Monthly balance",
  每月財務回顧: "Monthly financial review",
  沒有備註: "No note",
  淨資產: "Net worth",
  清單: "List",
  清除: "Clear",
  清除預計達成日期: "Clear target date",
  測試代碼: "Test code",
  無法開啟網頁: "Unable to open webpage",
  照片權限: "Photo access",
  現金: "Cash",
  現金與存款: "Cash and deposits",
  現金與活期存款: "Cash and checking accounts",
  生活費: "Living expenses",
  盤點我的負債: "Review my liabilities",
  盤點我的資產: "Review my assets",
  目前累積: "Current amount",
  目前進度: "Current progress",
  目前預算: "Current budget",
  目標金額: "Target amount",
  確定: "Confirm",
  確認刪除: "Confirm deletion",
  "確認是否刪除？": "Delete all local data?",
  第三方與追蹤: "Third parties and tracking",
  "管理個人權益與負債，查看資產負債結構。":
    "Manage personal equity and liabilities and review your balance sheet.",
  系統設定: "System settings",
  編輯財務項目: "Edit financial item",
  總個人權益: "Total personal equity",
  總合: "Total",
  總負債: "Total liabilities",
  總資產: "Total assets",
  "總資產 ＝ 總負債 ＋ 總個人權益":
    "Total assets = Total liabilities + Total personal equity",
  聯絡方式: "Contact",
  自訂提醒: "Custom reminder",
  薪資: "Salary",
  薪資收入: "Salary income",
  記得查看本月進度: "Review this month's progress",
  設定: "Settings",
  設定每月通知時間: "Monthly notification time",
  "請再試一次。": "Please try again.",
  "請稍後再試一次。": "Please try again later.",
  讓夢想: "Give dreams",
  負債: "Liabilities",
  負債總計: "Total liabilities",
  負債總額: "Total liabilities",
  財務: "Finance",
  財務設定: "Financial settings",
  財務資料已完成設定: "Financial profile completed",
  每月歷史變化: "Monthly history",
  目前資金結構: "Current funding structure",
  尚無每月快照記錄: "No monthly snapshots yet",
  返回: "Back",
  資料: "Data",
  資料保存: "Data storage",
  資料刪除: "Data deletion",
  資產總計: "Total assets",
  資產總額: "Total assets",
  資產負債表: "Balance sheet",
  資金結構: "Funding structure",
  資金結構詳情: "Funding structure details",
  資金來源結構: "Funding structure",
  查看資金結構與每月歷史變化:
    "View funding structure and monthly history",
  車貸: "Car loan",
  輸入你的雲端發票代碼: "Enter your mobile barcode",
  輸入備註: "Enter a note",
  輸入這筆收支的重點內容: "Add key details for this transaction",
  輸入通知顯示的內容: "Enter the notification message",
  輸入金額: "Enter amount",
  這一天還沒有紀錄: "No records for this day",
  這個夢想已經執行: "This dream has been completed",
  "這是系統預設項目，可調整金額，但無法修改名稱與類別。":
    "This is a system item. You can change the amount, but not its name or type.",
  "這次先不執行，夢想會保留在進行中。":
    "Not now. This dream will remain active.",
  通知權限: "Notification access",
  進行中的夢想: "Dreams in progress",
  選擇你的標示色: "Choose a highlight color",
  選擇圖片: "Choose image",
  選擇大頭照: "Choose profile photo",
  選擇年月: "Choose month",
  選擇日期: "Choose date",
  選擇預計達成日期: "Choose target date",
  還沒有夢想目標: "No dream goals yet",
  還沒有完成的夢想: "No completed dreams yet",
  重新選擇: "Choose again",
  重要提醒: "Important notice",
  金額: "Amount",
  "金額（NT$）": "Amount (NT$)",
  開始我的財務計畫: "Start my financial plan",
  開始盤點我的財務: "Review my finances",
  關閉: "Close",
  關閉完成清單: "Close completed list",
  隱私權說明: "Privacy policy",
  隱私與使用說明: "Privacy & user guide",
  雲端發票手機條碼: "Cloud invoice mobile barcode",
  "雲端發票（台灣限定使用）": "Cloud invoice (Taiwan only)",
  需償還的項目: "Amounts you need to repay",
  項目類型: "Item type",
  "預計達成日期（選填）": "Target date (optional)",
  預設: "Default",
  "預設・無法刪除": "Default · Cannot delete",
  類別: "Category",
  類別名稱: "Category name",
  "點擊可修改金額，系統項目名稱無法修改":
    "Tap to edit the amount. System item names cannot be changed.",
  "點擊查看詳情，向左滑動可以刪除": "Tap for details. Swipe left to delete.",
  "點擊編輯，向左滑動可以刪除": "Tap to edit. Swipe left to delete.",
  "＋ 新增": "+ Add",
  "＋ 新增一個項目": "+ Add item",
  "＋ 新增夢想": "+ Add dream",
  "＋ 新增通知": "+ Add notification",
  "＋ 新增項目": "+ Add item",
  現款: "Cash",
  暫時無法讀取資料: "Unable to load data",
  "請重新開啟 App 後再試一次。": "Please reopen Aimmora and try again.",
  "如需調整，請修改既有的分類或金額。": "Edit an existing category or amount if you need to make changes.",
  請確認輸入內容: "Check your entries",
  "每個項目都需填寫分類，金額請填入 0 或正確數字。": "Every item needs a category. Enter 0 or a valid amount.",
  "每個支出項目都需填寫分類，金額請填入 0 或正確數字。": "Every expense needs a category. Enter 0 or a valid amount.",
  資料尚未儲存成功: "Data was not saved",
  "請確認裝置儲存空間後再試一次。": "Check available device storage and try again.",
  設定尚未完成: "Setup was not completed",
  目前無法選擇圖片: "Unable to choose an image",
  "請確認相簿權限後再試一次。": "Check photo access and try again.",
  請完成夢想資料: "Complete the dream details",
  "請填寫夢想名稱、目標金額與每月分配金額。": "Enter a dream name, target amount, and monthly contribution.",
  超過本月可投入金額: "Monthly contribution exceeded",
  夢想尚未建立: "Dream was not created",
  夢想尚未執行: "Dream was not completed",
  項目尚未新增: "Item was not added",
  項目尚未更新: "Item was not updated",
  項目尚未刪除: "Item was not deleted",
  夢想尚未刪除: "Dream was not deleted",
  紀錄尚未新增: "Record was not added",
  支出內容尚未更新: "Expense was not updated",
  記錄尚未刪除: "Record was not deleted",
  顏色尚未更新: "Color was not updated",
  類別尚未新增: "Category was not added",
  類別尚未更新: "Category was not updated",
  類別尚未刪除: "Category was not deleted",
  請輸入使用者名稱: "Enter a user name",
  請確認雲端發票代碼: "Check the cloud invoice barcode",
  "手機條碼必須以 / 開頭，並接著 7 個英文、數字或 . + - 符號。": "The mobile barcode must start with / followed by 7 letters, numbers, or . + - symbols.",
  個人資料尚未更新: "Profile was not updated",
  固定財務項目尚未儲存: "Recurring item was not saved",
  尚未允許通知: "Notifications are not allowed",
  "請到手機系統設定中允許通知後再試一次。": "Allow notifications in system settings and try again.",
  提醒尚未儲存: "Reminder was not saved",
  "請確認通知權限後再試一次。": "Check notification access and try again.",
  提醒尚未刪除: "Reminder was not deleted",
  請完成項目資料: "Complete the item details",
  "請輸入項目名稱與大於 0 的金額。": "Enter an item name and an amount greater than 0.",
  "例如：銀行存款": "Example: Bank account",
  "例如：信用卡": "Example: Credit card",
  "例如：50,000": "Example: 50,000",
  一: "Mon",
  二: "Tue",
  三: "Wed",
  四: "Thu",
  五: "Fri",
  六: "Sat",
  請完成收支資料: "Complete the transaction details",
  "請選擇類別並輸入大於 0 的金額。": "Choose a category and enter an amount greater than 0.",
  "紀錄會依現在時間加入今天的收支。": "The transaction will be added using the current time.",
  "例如：150.50": "Example: 150.50",
  我: "Me",
  尚未輸入雲端發票代碼: "No cloud invoice barcode entered",
  "請先輸入你的手機條碼。": "Enter your mobile barcode first.",
  代碼格式不正確: "Invalid barcode format",
  "雲端發票手機條碼的第一碼必須是 /。": "The first character of the mobile barcode must be /.",
  "手機條碼必須為 / 加上 7 個英文、數字或 . + - 符號。": "The mobile barcode must contain / plus 7 letters, numbers, or . + - symbols.",
  "輸入財政部雲端發票手機條碼。": "Enter your Ministry of Finance cloud invoice mobile barcode.",
  "✓ 代碼格式正確": "✓ Barcode format is valid",
  "本版本先完成格式測試；是否已申請將在後續串接財政部 API 後確認。": "This version validates the format only. Registration will be verified after the Ministry of Finance API is connected.",
  "新增提醒後，App 會依照你設定的日期與時間定期通知。": "Aimmora will notify you monthly at the date and time you choose.",
  請完成提醒資料: "Complete the reminder details",
  "標題與提醒內容不可空白。": "Title and message are required.",
  "例如：本月夢想進度": "Example: This month’s dream progress",
  "所有夢想、財務、日曆、個人資料與通知設定都會從這台裝置永久刪除，且無法復原。": "All dreams, financial records, calendar entries, profile data, and notification settings will be permanently deleted from this device.",
  "目前的使用者名稱、大頭照、夢想、資產負債、收支、類別、提醒設定與雲端發票手機條碼，只儲存在本裝置的 App 資料庫中，不會主動上傳到開發者伺服器或提供給第三方。": "Your name, profile photo, dreams, finances, transactions, categories, reminders, and cloud invoice barcode are stored only in the app database on this device and are not uploaded to the developer or third parties.",
  "此欄位為選填且僅限台灣使用。目前版本只在本裝置保存條碼並檢查格式，不會將條碼傳送至財政部、開發者或第三方，也不會確認條碼是否已申請。": "This optional field is available in Taiwan only. The current version stores the barcode on this device and validates its format without sending it to the Ministry of Finance, the developer, or third parties.",
  "只有在你主動選擇大頭照或夢想圖片時，App 才會開啟 iOS 或 Android 的系統照片選擇器。App 只保存你選取的圖片，不會讀取整個相簿。": "Aimmora opens the iOS or Android photo picker only when you choose a profile or dream image. It stores only the selected image and does not read your entire library.",
  "只有在你新增提醒並同意系統權限後，App 才會建立本機通知。提醒由裝置系統依設定時間發送，不會用於廣告追蹤。": "Aimmora creates local notifications only after you add a reminder and grant permission. Notifications are scheduled by the device and are not used for advertising tracking.",
  "你可以從「我的 → 系統設定 → 資料」刪除全部本機資料。刪除後也會取消 App 已建立的通知排程。": "Delete all local data from Profile → System settings → Data. This also cancels notifications created by Aimmora.",
  "目前版本不使用第三方廣告、不販售個人資料，也不進行跨 App 或跨網站追蹤。若未來加入雲端同步、分析、發票 API 或其他第三方服務，隱私權內容會在啟用前更新。": "The current version has no third-party advertising, does not sell personal data, and does not track you across apps or websites. This policy will be updated before cloud sync, analytics, invoice APIs, or other third-party services are enabled.",
  "你可以隨時前往 iOS「設定」或 Android「設定」調整照片與通知權限。停用權限可能使相關功能無法使用，但不影響其他本機功能。": "You can manage photo and notification access in iOS or Android settings. Disabling access may affect those features but not other local features.",
  "開發者／資料處理負責人：Kuo Lung Huang": "Developer / Data controller: Kuo Lung Huang",
  "聯絡信箱：bezierline2026@gmail.com": "Email: bezierline2026@gmail.com",
  "App 操作說明": "App guide",
  "新增夢想名稱、圖片、目標金額、每月投入金額與預計日期，並查看達成進度。": "Add a dream name, image, target amount, monthly contribution, and target date, then track progress.",
  "選擇日期查看或新增收入與支出，並顯示固定收入、固定支出的日期標記與每月總和。": "Choose a date to view or add income and expenses, including recurring items and monthly totals.",
  "設定個人資料、雲端發票手機條碼、固定收支、收支類別與每月提醒通知，也可以查看本說明或刪除本機資料。": "Manage your profile, cloud invoice barcode, recurring finances, categories, monthly reminders, this guide, and local data.",
  "App 提供的是個人整理與規劃工具，不構成投資、會計、稅務或法律建議。重要財務決策請諮詢合格專業人士。": "Aimmora is a personal planning tool and does not provide investment, accounting, tax, or legal advice. Consult a qualified professional for important financial decisions.",
  "請檢查網路連線後再試一次。": "Check your internet connection and try again.",
  "這個顏色會套用到整份": "This color applies to the entire",
  "清單與日曆。": "list and calendar.",
  請完成固定財務資料: "Complete the recurring finance details",
  "既有紀錄不會被刪除，但之後無法再選擇這個類別。": "Existing records remain, but this category can no longer be selected.",
  請輸入類別名稱: "Enter a category name",
  "新增後會出現在日曆收支項目的類別滾輪。": "The category will appear in the calendar transaction picker.",
  "例如：獎金": "Example: Bonus",
  "例如：交通費": "Example: Transportation",
  "目標金額達成後，在夢想詳情按下「執行」，卡片才會移到這裡。": "Once the target is funded, open the dream details and choose Complete dream to move it here.",
  尚未安排每月分配: "No monthly contribution set",
  "查看夢想進度詳情，向左滑動可以刪除": "View dream progress. Swipe left to delete.",
  "例如：2027 冰島旅行": "Example: Iceland trip 2027",
  "例如：120,000": "Example: 120,000",
  "例如：5,000": "Example: 5,000",
  "一步步盤點財務現況，": "Review your finances step by step,",
  步驟: "Step",
  "記錄每月穩定的收入來源與金額。": "Record your stable monthly income sources and amounts.",
  "記錄每月固定支出，掌握真正可運用的資源。": "Record recurring monthly expenses to understand your available resources.",
  "最多可新增 10 個": "Up to 10",
  "項目（目前": "items (currently",
  "個）": ")",
  語言: "Language",
  文: "A",
  跟隨系統: "Follow system",
  繁體中文: "Traditional Chinese",
  "選擇 App 的顯示語言。": "Choose the language used in Aimmora.",
  "依手機語言與地區自動選擇": "Automatically choose based on device language and region",
  固定使用繁體中文: "Always display the app in Traditional Chinese",
  語言設定尚未更新: "Language setting was not updated",
  關於: "About",
  開發緣由: "Why we built this app",
  版本號: "Version",
  "版本 0.95": "Version 0.95",
  "每個夢想都需要資源，也需要一條看得見的前進路徑。夢想未來記帳本從「先理解自己的財務，再安排想完成的夢想」出發，將夢想清單、個人權益與負債、收支日曆整合在同一個 App，幫助使用者把日常記帳轉化為朝目標前進的行動。": "Every dream needs resources and a visible path forward. Aimmora starts with understanding your finances before planning the dreams you want to achieve. It brings your dream list, personal equity and liabilities, and income and expense calendar together in one app, helping turn everyday money tracking into meaningful progress toward your goals.",
};

const phraseReplacements: ReadonlyArray<readonly [string, string]> =
  Object.entries(english)
    .filter(([source]) => source.length >= 2)
    .sort(([left], [right]) => right.length - left.length);

export function t(value: string): string {
  if (appLanguage === "zh-Hant" || value === "") return value;
  const normalized = value.replace(/\s+/g, " ").trim();
  const numericPatterns: ReadonlyArray<readonly [RegExp, (match: RegExpMatchArray) => string]> = [
    [/^(\d+) 月$/, (match) => new Intl.DateTimeFormat("en-US", { month: "long" }).format(new Date(2024, Number(match[1]) - 1, 1))],
    [/^(\d+) 日$/, (match) => `Day ${match[1]}`],
    [/^每月 (\d+) 日$/, (match) => `Monthly on day ${match[1]}`],
    [/^(\d+) 時$/, (match) => `${match[1]} hr`],
    [/^(\d+) 分$/, (match) => `${match[1]} min`],
    [/^步驟 (\d+) \/ (\d+)$/, (match) => `Step ${match[1]} / ${match[2]}`],
    [/^可完成 (\d+) 個目標$/, (match) => `${match[1]} goals can be completed`],
    [/^仍需努力 (.+)$/, (match) => `${match[1]} still needed`],
    [/^目前尚可分配 (.+)。$/, (match) => `${match[1]} is still available.`],
    [/^最多 10 個(收入|支出)項目$/, (match) => `Up to 10 ${t(match[1]).toLowerCase()} items`],
    [/^(\d+) 個項目$/, (match) => `${match[1]} items`],
    [/^每月 (.+)・(\d+) 個項目$/, (match) => `Monthly ${match[1]} · ${match[2]} items`],
    [/^刪除「(.+)」？$/, (match) => `Delete “${match[1]}”?`],
    [/^(.+)清單$/, (match) => `${t(match[1])} list`],
    [/^約 (\d+) 個月後達成$/, (match) => `About ${match[1]} months to complete`],
    [/^依目前投入估算，約 (\d+) 個月後達成$/, (match) => `Estimated completion in about ${match[1]} months`],
    [/^預計達成時間 (.+)$/, (match) => `Target date  ${match[1]}`],
    [/^預計 (.+)達成$/, (match) => `Target ${match[1]}`],
    [/^本日收入記錄・(.+)$/, (match) => `Income records · ${match[1]}`],
    [/^本日支出記錄・(.+)$/, (match) => `Expense records · ${match[1]}`],
    [/^(目前預算) (.+) ・ (.+)$/, (match) => `${t(match[1])} ${match[2]} · ${t(match[3])}`],
  ];
  for (const [pattern, format] of numericPatterns) {
    const match = normalized.match(pattern);
    if (match) return format(match);
  }
  const exact = english[normalized];
  if (exact !== undefined) return exact;
  return phraseReplacements.reduce(
    (result, [source, target]) => result.replaceAll(source, target),
    normalized,
  );
}

function translateNode(node: ReactNode): ReactNode {
  if (typeof node === "string") return t(node);
  if (Array.isArray(node)) return Children.map(node, translateNode);
  return node;
}

export function Text({
  children,
  ...props
}: ComponentProps<typeof NativeText>) {
  return <NativeText {...props}>{translateNode(children)}</NativeText>;
}

export function TextInput(props: ComponentProps<typeof NativeTextInput>) {
  const localizedValue =
    typeof props.value === "string" ? t(props.value) : props.value;
  return (
    <NativeTextInput
      {...props}
      placeholder={props.placeholder ? t(props.placeholder) : undefined}
      value={localizedValue}
    />
  );
}

export function Pressable(props: ComponentProps<typeof NativePressable>) {
  return (
    <NativePressable
      {...props}
      accessibilityHint={
        props.accessibilityHint ? t(props.accessibilityHint) : undefined
      }
      accessibilityLabel={
        props.accessibilityLabel ? t(props.accessibilityLabel) : undefined
      }
    />
  );
}

function PickerItem(props: ComponentProps<typeof NativePicker.Item>) {
  return <NativePicker.Item {...props} label={t(props.label ?? "")} />;
}

export const Picker = Object.assign(NativePicker, { Item: PickerItem });

export function DateTimePicker(
  props: ComponentProps<typeof NativeDateTimePicker>,
) {
  return <NativeDateTimePicker {...props} locale={appLocale} />;
}

export const Alert = {
  alert(
    title: string,
    message?: string,
    buttons?: Parameters<typeof NativeAlert.alert>[2],
    options?: Parameters<typeof NativeAlert.alert>[3],
  ): void {
    const translatedButtons = buttons?.map((button) => ({
      ...button,
      text: button.text ? t(button.text) : button.text,
    }));
    NativeAlert.alert(
      t(title),
      message ? t(message) : undefined,
      translatedButtons,
      options,
    );
  },
};
