import { StatusBar } from 'expo-status-bar';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker, { type DateTimePickerChangeEvent } from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ImageBackground, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

type TabKey = 'dreams' | 'finance' | 'calendar' | 'profile';
type Step = 'welcome' | 'assets' | 'liabilities' | 'income' | 'expenses' | 'summary';
type EntryKind = 'asset' | 'liability' | 'income' | 'expense';
type Item = { id: string; category: string; amount: string };
type RecordItem = { kind: EntryKind; category: string; amount: number };
type ProfileRow = { onboarding_complete: number };
type AmountRow = { total: number };
type Dream = { id: number; title: string; target_amount: number; saved_amount: number; monthly_allocation: number; image_uri: string | null; target_date: string | null };
type TableColumn = { name: string };
type FinancialEntry = { id: number; kind: EntryKind; category: string; amount: number };
type StoredProfile = { display_name: string };
type TransactionKind = 'income' | 'expense';
type TransactionCategory = { id: number; kind: TransactionKind; name: string };
type CalendarTransaction = { id: number; kind: TransactionKind; category: string; amount: number; note: string; occurred_at: string };
type AppSetting = { key: string; value: string };

const DEFAULT_FIXED_INCOME_COLOR = '#A8DDB5';
const DEFAULT_FIXED_EXPENSE_COLOR = '#AFCBFF';
const MACARON_YELLOW = '#FFE8A3';

const databasePromise = openDatabaseAsync('my-dreams.db');
const tabs: ReadonlyArray<{ key: TabKey; label: string; icon: string }> = [
  { key: 'dreams', label: '夢想', icon: '✦' }, { key: 'finance', label: '財務', icon: '▦' },
  { key: 'calendar', label: '日曆', icon: '□' }, { key: 'profile', label: '我的', icon: '♙' },
];
const initialAssets: ReadonlyArray<Item> = [
  { id: 'cash', category: '現金與存款', amount: '' }, { id: 'investment', category: '投資', amount: '' },
  { id: 'property', category: '不動產', amount: '' }, { id: 'other-asset', category: '其他資產', amount: '' },
];
const initialLiabilities: ReadonlyArray<Item> = [
  { id: 'credit-card', category: '信用卡負債', amount: '' }, { id: 'mortgage', category: '房貸', amount: '' },
  { id: 'car-loan', category: '車貸', amount: '' }, { id: 'other-liability', category: '其他負債', amount: '' },
];
const initialIncome: ReadonlyArray<Item> = [{ id: 'salary', category: '薪資收入', amount: '' }];
const initialExpenses: ReadonlyArray<Item> = [{ id: 'living', category: '生活費', amount: '' }];

async function database(): Promise<SQLiteDatabase> {
  const db = await databasePromise;
  await db.execAsync(`PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS profile (id INTEGER PRIMARY KEY CHECK (id = 1), display_name TEXT NOT NULL, monthly_income REAL NOT NULL, onboarding_complete INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS financial_items (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, name TEXT NOT NULL, amount REAL NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS financial_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL CHECK (kind IN ('asset','liability','income','expense')), category TEXT NOT NULL, amount REAL NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS transaction_categories (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL CHECK (kind IN ('income','expense')), name TEXT NOT NULL, UNIQUE(kind, name));
    CREATE TABLE IF NOT EXISTS calendar_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL CHECK (kind IN ('income','expense')), category TEXT NOT NULL, amount REAL NOT NULL, note TEXT NOT NULL DEFAULT '', occurred_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS dreams (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, target_amount REAL NOT NULL, saved_amount REAL NOT NULL DEFAULT 0, monthly_allocation REAL NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);`);
  await db.execAsync(`INSERT OR IGNORE INTO transaction_categories (kind, name) VALUES ('income', '薪資'), ('income', '兼職'), ('expense', '餐費'), ('expense', '卡費'), ('expense', '夢想提撥');`);
  await db.runAsync('INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)', 'fixed_income_color', DEFAULT_FIXED_INCOME_COLOR);
  await db.runAsync('INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)', 'fixed_expense_color', DEFAULT_FIXED_EXPENSE_COLOR);
  const dreamColumns = await db.getAllAsync<TableColumn>('PRAGMA table_info(dreams)');
  if (!dreamColumns.some((column) => column.name === 'image_uri')) await db.execAsync('ALTER TABLE dreams ADD COLUMN image_uri TEXT');
  if (!dreamColumns.some((column) => column.name === 'target_date')) await db.execAsync('ALTER TABLE dreams ADD COLUMN target_date TEXT');
  return db;
}
function amount(value: string): number | null {
  const normalized = value.replace(/,/g, '').trim();
  if (normalized === '') return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}
function formatAmountInput(value: string): string {
  const digits = value.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
function formatDecimalInput(value: string): string {
  const cleaned = value.replace(/[^0-9.]/g, '');
  const [integer = '', ...decimalParts] = cleaned.split('.');
  const normalizedInteger = integer.replace(/^0+(?=\d)/, '');
  return decimalParts.length === 0 ? normalizedInteger : `${normalizedInteger}.${decimalParts.join('').slice(0, 2)}`;
}
function preciseMoney(value: number): string {
  return `NT$${value.toLocaleString('zh-TW', { maximumFractionDigits: 2, minimumFractionDigits: value % 1 === 0 ? 0 : 2 })}`;
}
function dateStorageValue(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
function dateDisplayValue(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return `${year} 年 ${month} 月 ${day} 日`;
}
function dateFromStorage(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}
function startOfToday(): Date {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate());
}
function total(items: ReadonlyArray<Item>): number { return items.reduce((sum, item) => sum + (amount(item.amount) ?? 0), 0); }
function money(value: number): string { return 'NT$' + Math.round(value).toLocaleString('zh-TW'); }
function valid(items: ReadonlyArray<Item>): boolean { return items.every((item) => item.category.trim() !== '' && amount(item.amount) !== null); }
function fillEmptyAmountsWithZero(items: ReadonlyArray<Item>): ReadonlyArray<Item> {
  return items.map((item) => ({ ...item, amount: item.amount.trim() === '' ? '0' : item.amount }));
}
async function readAmountTotal(db: SQLiteDatabase, kind: 'income' | 'expense'): Promise<number> {
  const row = await db.getFirstAsync<AmountRow>('SELECT COALESCE(SUM(amount), 0) AS total FROM financial_entries WHERE kind = ?', kind);
  return row?.total ?? 0;
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [complete, setComplete] = useState(false);
  const [step, setStep] = useState<Step>('welcome');
  const [activeTab, setActiveTab] = useState<TabKey>('dreams');
  const [assets, setAssets] = useState<ReadonlyArray<Item>>(initialAssets);
  const [liabilities, setLiabilities] = useState<ReadonlyArray<Item>>(initialLiabilities);
  const [income, setIncome] = useState<ReadonlyArray<Item>>(initialIncome);
  const [expenses, setExpenses] = useState<ReadonlyArray<Item>>(initialExpenses);
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [monthlyExpenses, setMonthlyExpenses] = useState(0);
  const [dreams, setDreams] = useState<ReadonlyArray<Dream>>([]);
  const [financialEntries, setFinancialEntries] = useState<ReadonlyArray<FinancialEntry>>([]);
  const [transactionCategories, setTransactionCategories] = useState<ReadonlyArray<TransactionCategory>>([]);
  const [calendarTransactions, setCalendarTransactions] = useState<ReadonlyArray<CalendarTransaction>>([]);
  const [fixedIncomeColor, setFixedIncomeColor] = useState(DEFAULT_FIXED_INCOME_COLOR);
  const [fixedExpenseColor, setFixedExpenseColor] = useState(DEFAULT_FIXED_EXPENSE_COLOR);
  const [displayName, setDisplayName] = useState('使用者');
  const [isDreamFormOpen, setIsDreamFormOpen] = useState(false);
  const [dreamTitle, setDreamTitle] = useState('');
  const [dreamTarget, setDreamTarget] = useState('');
  const [dreamAllocation, setDreamAllocation] = useState('');
  const [dreamImageUri, setDreamImageUri] = useState<string | null>(null);
  const [dreamTargetDate, setDreamTargetDate] = useState('');

  const loadDreamDashboard = async (db: SQLiteDatabase): Promise<void> => {
    const [incomeTotal, expenseTotal, storedDreams, storedEntries, storedProfile, storedCategories, storedTransactions, storedSettings] = await Promise.all([
      readAmountTotal(db, 'income'),
      readAmountTotal(db, 'expense'),
      db.getAllAsync<Dream>('SELECT id, title, target_amount, saved_amount, monthly_allocation, image_uri, target_date FROM dreams ORDER BY created_at ASC'),
      db.getAllAsync<FinancialEntry>('SELECT id, kind, category, amount FROM financial_entries ORDER BY id ASC'),
      db.getFirstAsync<StoredProfile>('SELECT display_name FROM profile WHERE id = 1'),
      db.getAllAsync<TransactionCategory>('SELECT id, kind, name FROM transaction_categories ORDER BY id ASC'),
      db.getAllAsync<CalendarTransaction>('SELECT id, kind, category, amount, note, occurred_at FROM calendar_transactions ORDER BY occurred_at DESC, id DESC'),
      db.getAllAsync<AppSetting>('SELECT key, value FROM app_settings'),
    ]);
    setMonthlyIncome(incomeTotal);
    setMonthlyExpenses(expenseTotal);
    setDreams(storedDreams);
    setFinancialEntries(storedEntries);
    setDisplayName(storedProfile?.display_name ?? '使用者');
    setTransactionCategories(storedCategories);
    setCalendarTransactions(storedTransactions);
    setFixedIncomeColor(storedSettings.find((setting) => setting.key === 'fixed_income_color')?.value ?? DEFAULT_FIXED_INCOME_COLOR);
    setFixedExpenseColor(storedSettings.find((setting) => setting.key === 'fixed_expense_color')?.value ?? DEFAULT_FIXED_EXPENSE_COLOR);
  };

  useEffect(() => {
    let mounted = true;
    const load = async (): Promise<void> => {
      try {
        const db = await database();
        const profile = await db.getFirstAsync<ProfileRow>('SELECT onboarding_complete FROM profile WHERE id = 1');
        if (mounted && profile?.onboarding_complete === 1) {
          await loadDreamDashboard(db);
          setComplete(true);
        }
      } catch { if (mounted) Alert.alert('暫時無法讀取資料', '請重新開啟 App 後再試一次。'); }
      finally { if (mounted) setLoading(false); }
    };
    void load();
    return () => { mounted = false; };
  }, []);

  const update = (kind: EntryKind, id: string, field: 'category' | 'amount', value: string): void => {
    const shouldFormatAmount = (kind === 'asset' || kind === 'liability' || kind === 'income' || kind === 'expense') && field === 'amount';
    const nextValue = shouldFormatAmount ? formatAmountInput(value) : value;
    const updateItems = (items: ReadonlyArray<Item>): ReadonlyArray<Item> => items.map((item) => item.id === id ? { ...item, [field]: nextValue } : item);
    if (kind === 'asset') setAssets(updateItems);
    if (kind === 'liability') setLiabilities(updateItems);
    if (kind === 'income') setIncome(updateItems);
    if (kind === 'expense') setExpenses(updateItems);
  };
  const add = (kind: 'income' | 'expense'): void => {
    const currentItems = kind === 'income' ? income : expenses;
    if (currentItems.length >= 10) {
      Alert.alert(`最多 10 個${kind === 'income' ? '收入' : '支出'}項目`, '如需調整，請修改既有的分類或金額。');
      return;
    }
    const item: Item = { id: kind + '-' + Date.now(), category: '', amount: '' };
    if (kind === 'income') setIncome((items) => [...items, item]);
    else setExpenses((items) => [...items, item]);
  };
  const next = (target: Step, items: ReadonlyArray<Item>): void => {
    if (!valid(items)) { Alert.alert('請確認輸入內容', '每個項目都需填寫分類，金額請填入 0 或正確數字。'); return; }
    if (target === 'liabilities') setAssets(fillEmptyAmountsWithZero(items));
    if (target === 'income') setLiabilities(fillEmptyAmountsWithZero(items));
    if (target === 'expenses') setIncome(fillEmptyAmountsWithZero(items));
    setStep(target);
  };
  const save = async (): Promise<void> => {
    if (!valid(expenses)) { Alert.alert('請確認輸入內容', '每個支出項目都需填寫分類，金額請填入 0 或正確數字。'); return; }
    const records: ReadonlyArray<RecordItem> = [
      ...assets.map((item) => ({ kind: 'asset' as const, category: item.category.trim(), amount: amount(item.amount) ?? 0 })),
      ...liabilities.map((item) => ({ kind: 'liability' as const, category: item.category.trim(), amount: amount(item.amount) ?? 0 })),
      ...income.map((item) => ({ kind: 'income' as const, category: item.category.trim(), amount: amount(item.amount) ?? 0 })),
      ...expenses.map((item) => ({ kind: 'expense' as const, category: item.category.trim(), amount: amount(item.amount) ?? 0 })),
    ];
    setSaving(true);
    try {
      const db = await database();
      await db.withTransactionAsync(async (): Promise<void> => {
        await db.runAsync(`INSERT INTO profile (id, display_name, monthly_income, onboarding_complete) VALUES (1, '使用者', ?, 0) ON CONFLICT(id) DO UPDATE SET monthly_income = excluded.monthly_income, onboarding_complete = 0`, total(income));
        await db.runAsync('DELETE FROM financial_entries');
        for (const record of records) await db.runAsync('INSERT INTO financial_entries (kind, category, amount) VALUES (?, ?, ?)', record.kind, record.category, record.amount);
      });
      setStep('summary');
    } catch { Alert.alert('資料尚未儲存成功', '請確認裝置儲存空間後再試一次。'); }
    finally { setSaving(false); }
  };
  const finish = async (): Promise<void> => {
    setSaving(true);
    try { const db = await database(); await db.runAsync('UPDATE profile SET onboarding_complete = 1 WHERE id = 1'); await loadDreamDashboard(db); setComplete(true); }
    catch { Alert.alert('設定尚未完成', '請再試一次。'); }
    finally { setSaving(false); }
  };
  const resetTestData = (): void => {
    Alert.alert('重設測試資料？', '這會刪除這個 App 的所有本機財務資料，且無法復原。', [
      { text: '取消', style: 'cancel' },
      {
        text: '重設',
        style: 'destructive',
        onPress: () => {
          void (async (): Promise<void> => {
            setSaving(true);
            try {
              const db = await database();
              await db.withTransactionAsync(async (): Promise<void> => {
                await db.runAsync('DELETE FROM financial_entries');
                await db.runAsync('DELETE FROM financial_items');
                await db.runAsync('DELETE FROM profile WHERE id = 1');
              });
              setAssets(initialAssets);
              setLiabilities(initialLiabilities);
              setIncome(initialIncome);
              setExpenses(initialExpenses);
              setMonthlyIncome(0);
              setMonthlyExpenses(0);
              setDreams([]);
              setFinancialEntries([]);
              setDisplayName('使用者');
              setStep('welcome');
              setComplete(false);
            } catch {
              Alert.alert('重設失敗', '請稍後再試一次。');
            } finally {
              setSaving(false);
            }
          })();
        },
      },
    ]);
  };
  const closeDreamForm = (): void => {
    setDreamTitle('');
    setDreamTarget('');
    setDreamAllocation('');
    setDreamImageUri(null);
    setDreamTargetDate('');
    setIsDreamFormOpen(false);
  };
  const pickDreamImage = async (): Promise<void> => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [4, 3],
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (!result.canceled) setDreamImageUri(result.assets[0].uri);
    } catch {
      Alert.alert('目前無法選擇圖片', '請確認相簿權限後再試一次。');
    }
  };
  const createDream = async (): Promise<void> => {
    const targetAmount = amount(dreamTarget);
    const allocationAmount = amount(dreamAllocation);
    const alreadyAllocated = dreams.reduce((sum, dream) => sum + dream.monthly_allocation, 0);
    const monthlyAvailable = Math.max(0, monthlyIncome - monthlyExpenses);
    if (dreamTitle.trim() === '' || targetAmount === null || targetAmount === 0 || allocationAmount === null) {
      Alert.alert('請完成夢想資料', '請填寫夢想名稱、目標金額與每月分配金額。');
      return;
    }
    if (allocationAmount + alreadyAllocated > monthlyAvailable) {
      Alert.alert('超過本月可投入金額', `目前尚可分配 ${money(Math.max(0, monthlyAvailable - alreadyAllocated))}。`);
      return;
    }
    setSaving(true);
    try {
      const db = await database();
      await db.runAsync(
        'INSERT INTO dreams (title, target_amount, monthly_allocation, image_uri, target_date) VALUES (?, ?, ?, ?, ?)',
        dreamTitle.trim(),
        targetAmount,
        allocationAmount,
        dreamImageUri,
        dreamTargetDate === '' ? null : dreamTargetDate,
      );
      await loadDreamDashboard(db);
      closeDreamForm();
    } catch {
      Alert.alert('夢想尚未建立', '請稍後再試一次。');
    } finally {
      setSaving(false);
    }
  };
  const createFinancialEntry = async (kind: 'asset' | 'liability', category: string, entryAmount: number): Promise<boolean> => {
    setSaving(true);
    try {
      const db = await database();
      await db.runAsync('INSERT INTO financial_entries (kind, category, amount) VALUES (?, ?, ?)', kind, category.trim(), entryAmount);
      await loadDreamDashboard(db);
      return true;
    } catch {
      Alert.alert('項目尚未新增', '請稍後再試一次。');
      return false;
    } finally {
      setSaving(false);
    }
  };
  const updateFinancialEntry = async (id: number, kind: 'asset' | 'liability', category: string, entryAmount: number): Promise<boolean> => {
    setSaving(true);
    try {
      const db = await database();
      await db.runAsync('UPDATE financial_entries SET kind = ?, category = ?, amount = ? WHERE id = ?', kind, category.trim(), entryAmount, id);
      await loadDreamDashboard(db);
      return true;
    } catch {
      Alert.alert('項目尚未更新', '請稍後再試一次。');
      return false;
    } finally {
      setSaving(false);
    }
  };
  const createCalendarTransaction = async (kind: TransactionKind, category: string, transactionAmount: number, note: string, occurredAt: string): Promise<boolean> => {
    setSaving(true);
    try {
      const db = await database();
      await db.runAsync('INSERT INTO calendar_transactions (kind, category, amount, note, occurred_at) VALUES (?, ?, ?, ?, ?)', kind, category, transactionAmount, note.trim(), occurredAt);
      await loadDreamDashboard(db);
      return true;
    } catch {
      Alert.alert('紀錄尚未新增', '請稍後再試一次。');
      return false;
    } finally {
      setSaving(false);
    }
  };
  const updateFixedFinanceColor = async (kind: TransactionKind, color: string): Promise<boolean> => {
    setSaving(true);
    try {
      const db = await database();
      const key = kind === 'income' ? 'fixed_income_color' : 'fixed_expense_color';
      await db.runAsync('INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, color);
      await loadDreamDashboard(db);
      return true;
    } catch {
      Alert.alert('顏色尚未更新', '請稍後再試一次。');
      return false;
    } finally {
      setSaving(false);
    }
  };
  const createTransactionCategory = async (kind: TransactionKind, name: string): Promise<boolean> => {
    setSaving(true);
    try {
      const db = await database();
      await db.runAsync('INSERT OR IGNORE INTO transaction_categories (kind, name) VALUES (?, ?)', kind, name.trim());
      await loadDreamDashboard(db);
      return true;
    } catch {
      Alert.alert('類別尚未新增', '請稍後再試一次。');
      return false;
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color="#087A50" size="large" /></View>;
  if (!complete) return <Onboarding step={step} assets={assets} liabilities={liabilities} income={income} expenses={expenses} saving={saving} onUpdate={update} onAdd={add} onNext={next} onSave={save} onFinish={finish} />;
  if (activeTab === 'dreams') return <DreamsHome dreams={dreams} isFormOpen={isDreamFormOpen} isSaving={saving} monthlyAvailable={Math.max(0, monthlyIncome - monthlyExpenses)} monthlyAllocated={dreams.reduce((sum, dream) => sum + dream.monthly_allocation, 0)} onCloseForm={closeDreamForm} onCreateDream={() => { setDreamTitle(''); setDreamTarget(''); setDreamAllocation(''); setDreamImageUri(null); setDreamTargetDate(''); setIsDreamFormOpen(true); }} onPickImage={() => { void pickDreamImage(); }} onSaveDream={createDream} onSetAllocation={(value) => setDreamAllocation(formatAmountInput(value))} onSetTarget={(value) => setDreamTarget(formatAmountInput(value))} onSetTargetDate={setDreamTargetDate} onSetTitle={setDreamTitle} setActiveTab={setActiveTab} dreamAllocation={dreamAllocation} dreamImageUri={dreamImageUri} dreamTarget={dreamTarget} dreamTargetDate={dreamTargetDate} dreamTitle={dreamTitle} />;
  if (activeTab === 'finance') return <FinanceHome entries={financialEntries} isSaving={saving} onAddEntry={createFinancialEntry} onUpdateEntry={updateFinancialEntry} setActiveTab={setActiveTab} />;
  if (activeTab === 'calendar') return <CalendarHome categories={transactionCategories} fixedExpenseColor={fixedExpenseColor} fixedIncomeColor={fixedIncomeColor} isSaving={saving} monthlyExpenses={monthlyExpenses} monthlyIncome={monthlyIncome} onAddTransaction={createCalendarTransaction} setActiveTab={setActiveTab} transactions={calendarTransactions} />;
  return <ProfileHome categories={transactionCategories} displayName={displayName} dreams={dreams} fixedExpenseColor={fixedExpenseColor} fixedIncomeColor={fixedIncomeColor} monthlyIncome={monthlyIncome} monthlyExpenses={monthlyExpenses} saving={saving} onAddCategory={createTransactionCategory} onReset={resetTestData} onUpdateFixedColor={updateFixedFinanceColor} setActiveTab={setActiveTab} />;
}

function MainTabs({ activeTab, setActiveTab }: { activeTab: TabKey; setActiveTab: (tab: TabKey) => void }) {
  return <View style={styles.tabBar}>{tabs.map((tab) => <Pressable key={tab.key} accessibilityRole="tab" accessibilityState={{ selected: tab.key === activeTab }} onPress={() => setActiveTab(tab.key)} style={styles.tab}><Text style={[styles.icon, tab.key === activeTab && styles.active]}>{tab.icon}</Text><Text style={[styles.tabText, tab.key === activeTab && styles.active]}>{tab.label}</Text></Pressable>)}</View>;
}

function FinanceHome({ entries, isSaving, onAddEntry, onUpdateEntry, setActiveTab }: { entries: ReadonlyArray<FinancialEntry>; isSaving: boolean; onAddEntry: (kind: 'asset' | 'liability', category: string, entryAmount: number) => Promise<boolean>; onUpdateEntry: (id: number, kind: 'asset' | 'liability', category: string, entryAmount: number) => Promise<boolean>; setActiveTab: (tab: TabKey) => void }) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<FinancialEntry | null>(null);
  const assets = entries.filter((entry) => entry.kind === 'asset');
  const liabilities = entries.filter((entry) => entry.kind === 'liability');
  const equityTotal = assets.reduce((sum, entry) => sum + entry.amount, 0);
  const liabilityTotal = liabilities.reduce((sum, entry) => sum + entry.amount, 0);
  const totalAssets = liabilityTotal + equityTotal;
  const liabilityRatio = totalAssets === 0 ? 0 : liabilityTotal / totalAssets;
  const edit = (entry: FinancialEntry): void => { setEditingEntry(entry); setIsFormOpen(true); };
  const closeForm = (): void => { setIsFormOpen(false); setEditingEntry(null); };
  return <View style={styles.container}><StatusBar style="dark" /><ScrollView contentContainerStyle={styles.pageContent}><View style={styles.pageHeading}><View><Text style={styles.pageTitle}>資產負債表</Text><Text style={styles.pageSubtitle}>總資產 ＝ 總負債 ＋ 總個人權益</Text></View></View><View style={styles.balanceCard}><Donut liabilityRatio={liabilityRatio} total={totalAssets} /><View style={styles.balanceLegend}><Text style={styles.cardTitle}>資金來源結構</Text><LegendRow color="#D76E62" label="總負債" value={liabilityTotal} /><LegendRow color="#087A50" label="總個人權益" value={equityTotal} /></View></View><FinanceSection title="個人權益" caption="你可支配的資源" entries={assets} color="#087A50" onPressEntry={edit} /><FinanceSection title="負債" caption="需償還的項目" entries={liabilities} color="#B94743" onPressEntry={edit} /><Pressable accessibilityRole="button" style={styles.financeAddButton} onPress={() => { setEditingEntry(null); setIsFormOpen(true); }}><Text style={styles.financeAddButtonText}>＋ 新增項目</Text></Pressable></ScrollView><MainTabs activeTab="finance" setActiveTab={setActiveTab} /><FinanceEntryForm key={editingEntry?.id ?? 'new'} initialEntry={editingEntry} isOpen={isFormOpen} isSaving={isSaving} onCancel={closeForm} onComplete={editingEntry === null ? onAddEntry : (kind, category, entryAmount) => onUpdateEntry(editingEntry.id, kind, category, entryAmount)} /></View>;
}
function Donut({ liabilityRatio, total }: { liabilityRatio: number; total: number }) {
  const circumference = 2 * Math.PI * 46;
  return <View style={styles.donutWrap}><Svg height={118} width={118} viewBox="0 0 108 108"><Circle cx="54" cy="54" fill="none" r="46" stroke="#DDEDE4" strokeWidth="14" /><Circle cx="54" cy="54" fill="none" r="46" rotation="-90" origin="54, 54" stroke="#D76E62" strokeDasharray={`${circumference * liabilityRatio} ${circumference}`} strokeLinecap="round" strokeWidth="14" /></Svg><View pointerEvents="none" style={styles.donutLabel}><Text style={styles.donutCaption}>總資產</Text><Text style={styles.donutValue}>{money(total)}</Text></View></View>;
}
function LegendRow({ color, label, value }: { color: string; label: string; value: number }) { return <View style={styles.legendRow}><View style={[styles.legendDot, { backgroundColor: color }]} /><Text style={styles.legendLabel}>{label}</Text><Text style={styles.legendValue}>{money(value)}</Text></View>; }
function FinanceSection({ title, caption, entries, color, onPressEntry }: { title: string; caption: string; entries: ReadonlyArray<FinancialEntry>; color: string; onPressEntry: (entry: FinancialEntry) => void }) {
  return <><View style={styles.sectionHeading}><Text style={styles.sectionHeadingText}>{title}</Text><Text style={styles.sectionCaption}>{caption}</Text></View><View style={styles.financeList}>{entries.map((entry) => <Pressable accessibilityHint="編輯這個財務項目" accessibilityRole="button" key={entry.id} onPress={() => onPressEntry(entry)} style={({ pressed }) => [styles.financeRow, pressed && styles.financeRowPressed]}><View style={styles.financeRowIcon}><Text style={styles.financeRowIconText}>{entry.kind === 'asset' ? '◆' : '▤'}</Text></View><Text style={styles.financeRowName}>{entry.category}</Text><Text style={[styles.financeRowAmount, { color }]}>{money(entry.amount)}</Text><Text style={styles.financeRowChevron}>›</Text></Pressable>)}</View></>;
}
function FinanceEntryForm({ initialEntry, isOpen, isSaving, onCancel, onComplete }: { initialEntry: FinancialEntry | null; isOpen: boolean; isSaving: boolean; onCancel: () => void; onComplete: (kind: 'asset' | 'liability', category: string, entryAmount: number) => Promise<boolean> }) {
  const initialKind = initialEntry?.kind === 'liability' ? 'liability' : 'asset';
  const [kind, setKind] = useState<'asset' | 'liability'>(initialKind);
  const [category, setCategory] = useState(initialEntry?.category ?? '');
  const [entryAmount, setEntryAmount] = useState(initialEntry ? formatAmountInput(String(initialEntry.amount)) : '');
  const close = (): void => { setKind('asset'); setCategory(''); setEntryAmount(''); onCancel(); };
  const submit = (): void => {
    const parsedAmount = amount(entryAmount);
    if (category.trim() === '' || parsedAmount === null || parsedAmount === 0) { Alert.alert('請完成項目資料', '請輸入項目名稱與大於 0 的金額。'); return; }
    void (async (): Promise<void> => {
      const succeeded = await onComplete(kind, category.trim(), parsedAmount);
      if (succeeded) close();
    })();
  };
  return <Modal animationType="slide" transparent visible={isOpen} onRequestClose={close}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalKeyboardView}><View style={styles.modalOverlay}><View style={styles.modalSheet}><ScrollView contentContainerStyle={styles.modalScrollContent} keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}><Text style={styles.modalTitle}>{initialEntry ? '編輯財務項目' : '新增財務項目'}</Text><Text style={styles.modalDescription}>{initialEntry ? '修改後會立即更新資產負債表。' : '新增後會立即更新資產負債表。'}</Text><Text style={styles.fieldLabel}>類別</Text><View style={styles.financeTypeSelector}><Pressable accessibilityRole="radio" accessibilityState={{ checked: kind === 'asset' }} style={[styles.financeTypeOption, kind === 'asset' && styles.financeTypeOptionActive]} onPress={() => setKind('asset')}><Text style={[styles.financeTypeOptionText, kind === 'asset' && styles.financeTypeOptionTextActive]}>個人權益</Text></Pressable><Pressable accessibilityRole="radio" accessibilityState={{ checked: kind === 'liability' }} style={[styles.financeTypeOption, kind === 'liability' && styles.financeTypeOptionActive]} onPress={() => setKind('liability')}><Text style={[styles.financeTypeOptionText, kind === 'liability' && styles.financeTypeOptionTextActive]}>負債</Text></Pressable></View><Text style={styles.fieldLabel}>名稱</Text><TextInput autoFocus placeholder={kind === 'asset' ? '例如：銀行存款' : '例如：信用卡'} placeholderTextColor="#9AA5B4" returnKeyType="next" style={styles.modalInput} value={category} onChangeText={setCategory} /><Text style={styles.fieldLabel}>金額</Text><TextInput keyboardType="numeric" placeholder="例如：50,000" placeholderTextColor="#9AA5B4" returnKeyType="done" style={styles.modalInput} value={entryAmount} onChangeText={(value) => setEntryAmount(formatAmountInput(value))} /><Pressable disabled={isSaving} style={[styles.modalPrimaryButton, isSaving && styles.disabled]} onPress={submit}>{isSaving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>完成</Text>}</Pressable><Pressable disabled={isSaving} style={styles.modalCancelButton} onPress={close}><Text style={styles.modalCancelText}>取消</Text></Pressable></ScrollView></View></View></KeyboardAvoidingView></Modal>;
}

function CalendarHome({ categories, fixedExpenseColor, fixedIncomeColor, isSaving, monthlyExpenses, monthlyIncome, onAddTransaction, setActiveTab, transactions }: { categories: ReadonlyArray<TransactionCategory>; fixedExpenseColor: string; fixedIncomeColor: string; isSaving: boolean; monthlyExpenses: number; monthlyIncome: number; onAddTransaction: (kind: TransactionKind, category: string, transactionAmount: number, note: string, occurredAt: string) => Promise<boolean>; setActiveTab: (tab: TabKey) => void; transactions: ReadonlyArray<CalendarTransaction> }) {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState(now.getDate());
  const [pendingYear, setPendingYear] = useState(selectedYear);
  const [pendingMonth, setPendingMonth] = useState(selectedMonth);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const days = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const leading = new Date(selectedYear, selectedMonth, 1).getDay();
  const calendarCells: ReadonlyArray<number | null> = [...Array.from({ length: leading }, () => null), ...Array.from({ length: days }, (_, index) => index + 1)];
  const transactionsForDay = (day: number): ReadonlyArray<CalendarTransaction> => transactions.filter((transaction) => { const date = new Date(transaction.occurred_at); return date.getFullYear() === selectedYear && date.getMonth() === selectedMonth && date.getDate() === day; });
  const selectedTransactions = transactionsForDay(selectedDay);
  const selectedIncome = selectedTransactions.filter((transaction) => transaction.kind === 'income');
  const selectedExpenses = selectedTransactions.filter((transaction) => transaction.kind === 'expense');
  const openMonthPicker = (): void => { setPendingYear(selectedYear); setPendingMonth(selectedMonth); setIsMonthPickerOpen(true); };
  const selectedDateLabel = `${selectedMonth + 1} 月 ${selectedDay} 日`;
  const selectedDate = new Date(selectedYear, selectedMonth, selectedDay, now.getHours(), now.getMinutes(), now.getSeconds());
  return <View style={styles.container}><StatusBar style="dark" /><ScrollView contentContainerStyle={styles.pageContent}><View style={styles.pageHeading}><Text style={styles.pageTitle}>收支日曆</Text><Pressable accessibilityRole="button" style={styles.monthSelectButton} onPress={openMonthPicker}><Text style={styles.monthSelectText}>{selectedYear} 年 {selectedMonth + 1} 月</Text><Text style={styles.monthSelectChevron}>⌄</Text></Pressable></View><View style={styles.calendarLegend}><LegendChip color="#087A50" label="收入" /><LegendChip color="#D76E62" label="支出" /><LegendChip color={fixedIncomeColor} label="固定收入" /><LegendChip color={fixedExpenseColor} label="固定支出" /></View><View style={styles.calendarCard}><View style={styles.weekRow}>{['日','一','二','三','四','五','六'].map((day) => <Text key={day} style={styles.weekText}>{day}</Text>)}</View><View style={styles.calendarGrid}>{calendarCells.map((day, index) => { const dailyTransactions = day === null ? [] : transactionsForDay(day); const incomeTotal = dailyTransactions.filter((transaction) => transaction.kind === 'income').reduce((sum, transaction) => sum + transaction.amount, 0); const expenseTotal = dailyTransactions.filter((transaction) => transaction.kind === 'expense').reduce((sum, transaction) => sum + transaction.amount, 0); const isToday = day === now.getDate() && selectedYear === now.getFullYear() && selectedMonth === now.getMonth(); const isSelected = day === selectedDay; return <Pressable disabled={day === null} key={`${day ?? 'empty'}-${index}`} onPress={() => { if (day !== null) setSelectedDay(day); }} style={[styles.calendarDay, styles.calendarDayWithTotals, isToday && styles.calendarToday, isSelected && styles.calendarSelected]}><Text style={[styles.calendarDayText, isToday && styles.calendarTodayText, isSelected && styles.calendarSelectedText]}>{day ?? ''}</Text>{incomeTotal > 0 && <Text numberOfLines={1} style={styles.calendarIncomeAmount}>+{compactAmount(incomeTotal)}</Text>}{expenseTotal > 0 && <Text numberOfLines={1} style={styles.calendarExpenseAmount}>−{compactAmount(expenseTotal)}</Text>}{day === 5 && <View style={[styles.fixedCalendarMark, { backgroundColor: fixedIncomeColor }]} />}{day === 10 && <View style={[styles.fixedCalendarMark, styles.fixedCalendarMarkSecond, { backgroundColor: fixedExpenseColor }]} />}</Pressable>; })}</View></View><Text style={styles.activityTitle}>每月固定財務</Text><View style={styles.fixedFinanceGrid}><FixedFinanceCard amount={monthlyIncome} color={fixedIncomeColor} dateLabel="每月 5 日" label="固定收入" /><FixedFinanceCard amount={monthlyExpenses} color={fixedExpenseColor} dateLabel="每月 10 日" label="固定支出" /></View><TransactionSection title={`本日收入記錄・${selectedDateLabel}`} transactions={selectedIncome} /><TransactionSection title={`本日支出記錄・${selectedDateLabel}`} transactions={selectedExpenses} /><Pressable accessibilityRole="button" style={styles.financeAddButton} onPress={() => setIsFormOpen(true)}><Text style={styles.financeAddButtonText}>＋ 新增項目</Text></Pressable></ScrollView><MainTabs activeTab="calendar" setActiveTab={setActiveTab} /><MonthPickerModal isOpen={isMonthPickerOpen} month={pendingMonth} onCancel={() => setIsMonthPickerOpen(false)} onConfirm={() => { setSelectedYear(pendingYear); setSelectedMonth(pendingMonth); setSelectedDay(pendingYear === now.getFullYear() && pendingMonth === now.getMonth() ? now.getDate() : 1); setIsMonthPickerOpen(false); }} onMonthChange={setPendingMonth} onYearChange={setPendingYear} year={pendingYear} /><CalendarEntryForm categories={categories} isOpen={isFormOpen} isSaving={isSaving} onCancel={() => setIsFormOpen(false)} onComplete={async (kind, category, transactionAmount, note) => { const succeeded = await onAddTransaction(kind, category, transactionAmount, note, selectedDate.toISOString()); if (succeeded) setIsFormOpen(false); return succeeded; }} /></View>;
}
function FixedFinanceCard({ amount: cardAmount, color, dateLabel, label }: { amount: number; color: string; dateLabel: string; label: string }) { return <View style={[styles.fixedFinanceCard, { borderTopColor: color }]}><View style={styles.fixedFinanceCardHeader}><View style={[styles.fixedFinanceSwatch, { backgroundColor: color }]} /><Text style={styles.fixedFinanceLabel}>{label}</Text></View><Text style={styles.fixedFinanceAmount}>{preciseMoney(cardAmount)}</Text><Text style={styles.fixedFinanceDate}>{dateLabel}</Text></View>; }
function compactAmount(value: number): string { return value >= 10000 ? `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k` : value.toLocaleString('zh-TW', { maximumFractionDigits: 1 }); }
function LegendChip({ color, label }: { color: string; label: string }) { return <View style={styles.legendChip}><View style={[styles.legendDot, { backgroundColor: color }]} /><Text style={styles.legendChipText}>{label}</Text></View>; }
function TransactionSection({ title, transactions }: { title: string; transactions: ReadonlyArray<CalendarTransaction> }) { return <><Text style={styles.activityTitle}>{title}</Text><View style={styles.transactionList}>{transactions.length === 0 ? <Text style={styles.emptyTransactionText}>這一天還沒有紀錄</Text> : transactions.map((transaction) => <View key={transaction.id} style={styles.transactionRow}><View style={[styles.transactionKindDot, { backgroundColor: transaction.kind === 'income' ? '#087A50' : '#D76E62' }]} /><View style={styles.transactionCopy}><Text style={styles.transactionCategory}>{transaction.category}</Text><Text numberOfLines={1} style={styles.transactionNote}>{transaction.note || '沒有備註'}・{new Date(transaction.occurred_at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}</Text></View><Text style={[styles.transactionAmount, { color: transaction.kind === 'income' ? '#087A50' : '#B94743' }]}>{transaction.kind === 'income' ? '+' : '−'}{preciseMoney(transaction.amount)}</Text></View>)}</View></>; }
function MonthPickerModal({ isOpen, month, onCancel, onConfirm, onMonthChange, onYearChange, year }: { isOpen: boolean; month: number; onCancel: () => void; onConfirm: () => void; onMonthChange: (month: number) => void; onYearChange: (year: number) => void; year: number }) {
  const years = Array.from({ length: 131 }, (_, index) => 1970 + index);
  return <Modal animationType="slide" transparent visible={isOpen} onRequestClose={onCancel}><View style={styles.modalOverlay}><View style={styles.pickerSheet}><Text style={styles.modalTitle}>選擇年月</Text><View style={styles.yearMonthPickers}><Picker selectedValue={year} style={styles.yearMonthPicker} onValueChange={(value: number) => onYearChange(value)}>{years.map((value) => <Picker.Item key={value} label={`${value} 年`} value={value} />)}</Picker><Picker selectedValue={month} style={styles.yearMonthPicker} onValueChange={(value: number) => onMonthChange(value)}>{Array.from({ length: 12 }, (_, index) => <Picker.Item key={index} label={`${index + 1} 月`} value={index} />)}</Picker></View><View style={styles.datePickerActions}><Pressable style={styles.datePickerCancel} onPress={onCancel}><Text style={styles.datePickerCancelText}>取消</Text></Pressable><Pressable style={styles.datePickerConfirm} onPress={onConfirm}><Text style={styles.datePickerConfirmText}>完成</Text></Pressable></View></View></View></Modal>;
}
function CalendarEntryForm({ categories, isOpen, isSaving, onCancel, onComplete }: { categories: ReadonlyArray<TransactionCategory>; isOpen: boolean; isSaving: boolean; onCancel: () => void; onComplete: (kind: TransactionKind, category: string, transactionAmount: number, note: string) => Promise<boolean> }) {
  const [kind, setKind] = useState<TransactionKind>('income');
  const options = categories.filter((category) => category.kind === kind);
  const [category, setCategory] = useState('薪資');
  const [transactionAmount, setTransactionAmount] = useState('');
  const [note, setNote] = useState('');
  const changeKind = (nextKind: TransactionKind): void => { setKind(nextKind); const firstCategory = categories.find((item) => item.kind === nextKind); setCategory(firstCategory?.name ?? ''); };
  const close = (): void => { setKind('income'); setCategory('薪資'); setTransactionAmount(''); setNote(''); onCancel(); };
  const submit = (): void => { const parsedAmount = amount(transactionAmount); if (category === '' || parsedAmount === null || parsedAmount === 0) { Alert.alert('請完成收支資料', '請選擇類別並輸入大於 0 的金額。'); return; } void (async (): Promise<void> => { const succeeded = await onComplete(kind, category, parsedAmount, note); if (succeeded) close(); })(); };
  return <Modal animationType="slide" transparent visible={isOpen} onRequestClose={close}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalKeyboardView}><View style={styles.modalOverlay}><View style={styles.modalSheet}><ScrollView contentContainerStyle={styles.modalScrollContent} keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled"><Text style={styles.modalTitle}>新增收支項目</Text><Text style={styles.modalDescription}>紀錄會依現在時間加入今天的收支。</Text><Text style={styles.fieldLabel}>項目類型</Text><View style={styles.financeTypeSelector}><Pressable style={[styles.financeTypeOption, kind === 'income' && styles.financeTypeOptionActive]} onPress={() => changeKind('income')}><Text style={[styles.financeTypeOptionText, kind === 'income' && styles.financeTypeOptionTextActive]}>收入</Text></Pressable><Pressable style={[styles.financeTypeOption, kind === 'expense' && styles.financeTypeOptionActive]} onPress={() => changeKind('expense')}><Text style={[styles.financeTypeOptionText, kind === 'expense' && styles.financeTypeOptionTextActive]}>支出</Text></Pressable></View><Text style={styles.fieldLabel}>類別</Text><View style={styles.categoryPickerBox}><Picker selectedValue={category} onValueChange={(value: string) => setCategory(value)}>{options.map((option) => <Picker.Item key={option.id} label={option.name} value={option.name} />)}</Picker></View><Text style={styles.fieldLabel}>金額</Text><TextInput keyboardType="decimal-pad" placeholder="例如：150.50" placeholderTextColor="#9AA5B4" style={styles.modalInput} value={transactionAmount} onChangeText={(value) => setTransactionAmount(formatDecimalInput(value))} /><Text style={styles.fieldLabel}>備註</Text><TextInput multiline placeholder="輸入這筆收支的重點內容" placeholderTextColor="#9AA5B4" style={[styles.modalInput, styles.noteInput]} value={note} onChangeText={setNote} /><Pressable disabled={isSaving} style={[styles.modalPrimaryButton, isSaving && styles.disabled]} onPress={submit}>{isSaving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>完成</Text>}</Pressable><Pressable disabled={isSaving} style={styles.modalCancelButton} onPress={close}><Text style={styles.modalCancelText}>取消</Text></Pressable></ScrollView></View></View></KeyboardAvoidingView></Modal>;
}

function ProfileHome({ categories, displayName, dreams, fixedExpenseColor, fixedIncomeColor, monthlyIncome, monthlyExpenses, saving, onAddCategory, onReset, onUpdateFixedColor, setActiveTab }: { categories: ReadonlyArray<TransactionCategory>; displayName: string; dreams: ReadonlyArray<Dream>; fixedExpenseColor: string; fixedIncomeColor: string; monthlyIncome: number; monthlyExpenses: number; saving: boolean; onAddCategory: (kind: TransactionKind, name: string) => Promise<boolean>; onReset: () => void; onUpdateFixedColor: (kind: TransactionKind, color: string) => Promise<boolean>; setActiveTab: (tab: TabKey) => void }) {
  const [categoryKind, setCategoryKind] = useState<TransactionKind>('income');
  const [isCategoryFormOpen, setIsCategoryFormOpen] = useState(false);
  const [colorKind, setColorKind] = useState<TransactionKind | null>(null);
  const initial = displayName.trim().slice(0, 1).toUpperCase() || '我';
  const openCategoryForm = (kind: TransactionKind): void => { setCategoryKind(kind); setIsCategoryFormOpen(true); };
  const categoryNames = (kind: TransactionKind): string => categories.filter((category) => category.kind === kind).map((category) => category.name).join('、');
  return <View style={styles.container}><StatusBar style="dark" /><ScrollView contentContainerStyle={styles.pageContent}><View style={styles.pageHeading}><Text style={styles.pageTitle}>我的</Text><View style={styles.headerAction}><Text style={styles.headerActionText}>設定</Text></View></View><View style={styles.profileHeader}><View style={styles.profileAvatar}><Text style={styles.profileAvatarText}>{initial}</Text></View><View><Text style={styles.profileName}>{displayName}</Text><Text style={styles.pageSubtitle}>財務資料已完成設定</Text></View></View><View style={styles.profileSummaryCard}><View><Text style={styles.profileSummaryLabel}>進行中的夢想</Text><Text style={styles.profileSummaryValue}>{dreams.length} 個</Text></View><View style={styles.profileSummaryDivider} /><View><Text style={styles.profileSummaryLabel}>每月可投入</Text><Text style={styles.profileSummaryValue}>{money(Math.max(0, monthlyIncome - monthlyExpenses))}</Text></View></View><Text style={styles.activityTitle}>財務設定</Text><ProfileRow color={fixedIncomeColor} icon="◎" title="固定收入" detail={`每月 ${money(monthlyIncome)}・點選設定顏色`} onPress={() => setColorKind('income')} /><ProfileRow color={fixedExpenseColor} icon="□" title="固定支出" detail={`每月 ${money(monthlyExpenses)}・點選設定顏色`} onPress={() => setColorKind('expense')} /><ProfileRow icon="＋" title="收入類別" detail={categoryNames('income')} onPress={() => openCategoryForm('income')} /><ProfileRow icon="＋" title="支出類別" detail={categoryNames('expense')} onPress={() => openCategoryForm('expense')} /><ProfileRow icon="♧" title="提醒通知" detail="夢想進度與每月回顧" /><Text style={styles.activityTitle}>資料與支援</Text><ProfileRow icon="▣" title="本機資料" detail="目前資料保存在這台裝置" /><ProfileRow icon="?" title="隱私與使用說明" detail="了解資料的保存方式" />{__DEV__ && <Pressable disabled={saving} style={styles.resetButton} onPress={onReset}><Text style={styles.resetButtonText}>重設測試資料</Text></Pressable>}</ScrollView><MainTabs activeTab="profile" setActiveTab={setActiveTab} /><CategoryForm initialKind={categoryKind} isOpen={isCategoryFormOpen} isSaving={saving} onCancel={() => setIsCategoryFormOpen(false)} onComplete={onAddCategory} /><ColorPickerModal currentColor={colorKind === 'income' ? fixedIncomeColor : fixedExpenseColor} isOpen={colorKind !== null} kind={colorKind ?? 'income'} onCancel={() => setColorKind(null)} onComplete={async (kind, color) => { const succeeded = await onUpdateFixedColor(kind, color); if (succeeded) setColorKind(null); return succeeded; }} /></View>;
}
function ProfileRow({ color, icon, title, detail, onPress }: { color?: string; icon: string; title: string; detail: string; onPress?: () => void }) { return <Pressable disabled={!onPress} onPress={onPress} style={({ pressed }) => [styles.profileRow, pressed && styles.financeRowPressed]}><View style={styles.profileRowIcon}><Text style={styles.profileRowIconText}>{icon}</Text></View><View style={styles.profileRowCopy}><Text style={styles.profileRowTitle}>{title}</Text><Text numberOfLines={1} style={styles.profileRowDetail}>{detail}</Text></View>{color && <View style={[styles.profileColorSwatch, { backgroundColor: color }]} />}<Text style={styles.profileChevron}>›</Text></Pressable>; }
function ColorPickerModal({ currentColor, isOpen, kind, onCancel, onComplete }: { currentColor: string; isOpen: boolean; kind: TransactionKind; onCancel: () => void; onComplete: (kind: TransactionKind, color: string) => Promise<boolean> }) {
  const palette = ['#FFE8A3', '#F8C8DC', '#A8DDB5', '#AFCBFF', '#D8C4F1', '#FFD0A8'];
  const [selectedColor, setSelectedColor] = useState(currentColor);
  useEffect(() => { if (isOpen) setSelectedColor(currentColor); }, [currentColor, isOpen]);
  return <Modal animationType="slide" transparent visible={isOpen} onRequestClose={onCancel}><View style={styles.modalOverlay}><View style={styles.pickerSheet}><Text style={styles.modalTitle}>設定{kind === 'income' ? '固定收入' : '固定支出'}顏色</Text><Text style={styles.modalDescription}>顏色會同步顯示在每月固定財務卡片與日曆日期上。</Text><View style={styles.colorPalette}>{palette.map((color) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: selectedColor === color }} key={color} onPress={() => setSelectedColor(color)} style={[styles.colorOption, { backgroundColor: color }, selectedColor === color && styles.colorOptionSelected]}>{selectedColor === color && <Text style={styles.colorCheck}>✓</Text>}</Pressable>)}</View><View style={styles.datePickerActions}><Pressable style={styles.datePickerCancel} onPress={onCancel}><Text style={styles.datePickerCancelText}>取消</Text></Pressable><Pressable style={styles.datePickerConfirm} onPress={() => { void onComplete(kind, selectedColor); }}><Text style={styles.datePickerConfirmText}>完成</Text></Pressable></View></View></View></Modal>;
}
function CategoryForm({ initialKind, isOpen, isSaving, onCancel, onComplete }: { initialKind: TransactionKind; isOpen: boolean; isSaving: boolean; onCancel: () => void; onComplete: (kind: TransactionKind, name: string) => Promise<boolean> }) {
  const [name, setName] = useState('');
  const close = (): void => { setName(''); onCancel(); };
  const submit = (): void => { if (name.trim() === '') { Alert.alert('請輸入類別名稱'); return; } void (async (): Promise<void> => { const succeeded = await onComplete(initialKind, name.trim()); if (succeeded) close(); })(); };
  return <Modal animationType="slide" transparent visible={isOpen} onRequestClose={close}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalKeyboardView}><View style={styles.modalOverlay}><View style={styles.modalSheet}><View style={styles.modalScrollContent}><Text style={styles.modalTitle}>新增{initialKind === 'income' ? '收入' : '支出'}類別</Text><Text style={styles.modalDescription}>新增後會出現在日曆收支項目的類別滾輪。</Text><Text style={styles.fieldLabel}>類別名稱</Text><TextInput autoFocus placeholder={initialKind === 'income' ? '例如：獎金' : '例如：交通費'} placeholderTextColor="#9AA5B4" style={styles.modalInput} value={name} onChangeText={setName} /><Pressable disabled={isSaving} style={[styles.modalPrimaryButton, isSaving && styles.disabled]} onPress={submit}>{isSaving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>完成</Text>}</Pressable><Pressable style={styles.modalCancelButton} onPress={close}><Text style={styles.modalCancelText}>取消</Text></Pressable></View></View></View></KeyboardAvoidingView></Modal>;
}

type DreamsHomeProps = {
  dreamAllocation: string;
  dreamTarget: string;
  dreamTitle: string;
  dreamImageUri: string | null;
  dreamTargetDate: string;
  dreams: ReadonlyArray<Dream>;
  isFormOpen: boolean;
  isSaving: boolean;
  monthlyAllocated: number;
  monthlyAvailable: number;
  onCloseForm: () => void;
  onCreateDream: () => void;
  onPickImage: () => void;
  onSaveDream: () => void;
  onSetAllocation: (value: string) => void;
  onSetTarget: (value: string) => void;
  onSetTargetDate: (value: string) => void;
  onSetTitle: (value: string) => void;
  setActiveTab: (tab: TabKey) => void;
};
function DreamsHome(props: DreamsHomeProps) {
  const [selectedDream, setSelectedDream] = useState<Dream | null>(null);
  const monthlyRemaining = Math.max(0, props.monthlyAvailable - props.monthlyAllocated);
  return <View style={styles.container}><StatusBar style="dark" /><ScrollView contentContainerStyle={styles.dreamsContent}><Text style={styles.dreamsTitle}>我的夢想</Text><View style={styles.availableCard}><Text style={styles.availableLabel}>本月可投入夢想</Text><Text accessibilityLiveRegion="polite" style={styles.availableValue}>{money(props.monthlyAvailable)}</Text><Text style={styles.availableDetail}>已分配 {money(props.monthlyAllocated)} ・ 尚可分配 {money(monthlyRemaining)}</Text></View><View style={styles.dreamsSectionHeader}><Text style={styles.dreamsSectionTitle}>進行中的夢想</Text><Text style={styles.dreamCount}>{props.dreams.length} 個</Text></View>{props.dreams.length === 0 ? <View style={styles.emptyDreams}><Text style={styles.emptyDreamsTitle}>還沒有夢想目標</Text><Text style={styles.emptyDreamsText}>建立第一個目標，開始把每月可用資源分配給夢想。</Text></View> : props.dreams.map((dream) => <DreamCard key={dream.id} dream={dream} onPress={() => setSelectedDream(dream)} />)}<Pressable accessibilityRole="button" style={styles.createDreamButton} onPress={props.onCreateDream}><Text style={styles.createDreamButtonText}>＋ 新增夢想</Text></Pressable></ScrollView><View style={styles.tabBar}>{tabs.map((tab) => <Pressable key={tab.key} accessibilityRole="tab" accessibilityState={{ selected: tab.key === 'dreams' }} onPress={() => props.setActiveTab(tab.key)} style={styles.tab}><Text style={[styles.icon, tab.key === 'dreams' && styles.active]}>{tab.icon}</Text><Text style={[styles.tabText, tab.key === 'dreams' && styles.active]}>{tab.label}</Text></Pressable>)}</View><DreamForm {...props} /><DreamDetail dream={selectedDream} onClose={() => setSelectedDream(null)} /></View>;
}
function DreamCard({ dream, onPress }: { dream: Dream; onPress: () => void }) {
  const percent = dream.target_amount === 0 ? 0 : Math.min(100, Math.round((dream.saved_amount / dream.target_amount) * 100));
  const remainingAmount = Math.max(0, dream.target_amount - dream.saved_amount);
  const months = dream.monthly_allocation === 0 ? null : Math.ceil(remainingAmount / dream.monthly_allocation);
  const timing = dream.target_date ? `預計 ${dateDisplayValue(dream.target_date)}達成` : months === null ? '尚未安排每月分配' : `約 ${months} 個月後達成`;
  return <Pressable accessibilityHint="查看夢想進度詳情" accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.dreamCard, pressed && styles.dreamCardPressed]}>{dream.image_uri ? <Image source={{ uri: dream.image_uri }} style={styles.dreamImage} /> : <View style={styles.dreamIcon}><Text style={styles.dreamIconText}>✦</Text></View>}<View style={styles.dreamMeta}><View style={styles.dreamTitleLine}><Text numberOfLines={1} style={styles.dreamName}>{dream.title}</Text><Text style={styles.dreamPercent}>{percent}%</Text></View><Text style={styles.dreamDetail}>目前累積 {money(dream.saved_amount)}／{money(dream.target_amount)}</Text><Text style={styles.dreamTiming}>{timing}</Text><View style={styles.dreamProgressTrack}><View style={[styles.dreamProgressFill, { width: `${percent}%` as `${number}%` }]} /></View></View></Pressable>;
}
function DreamDetail({ dream, onClose }: { dream: Dream | null; onClose: () => void }) {
  if (dream === null) return null;
  const percent = dream.target_amount === 0 ? 0 : Math.min(100, Math.round((dream.saved_amount / dream.target_amount) * 100));
  const expired = dream.target_date !== null && new Date(`${dream.target_date}T23:59:59`).getTime() < Date.now();
  const remainingAmount = Math.max(0, dream.target_amount - dream.saved_amount);
  const months = dream.monthly_allocation === 0 ? null : Math.ceil(remainingAmount / dream.monthly_allocation);
  const timing = dream.target_date ? `預計達成時間　${dateDisplayValue(dream.target_date)}` : months === null ? '尚未安排每月分配' : `依目前投入估算，約 ${months} 個月後達成`;
  return <Modal animationType="slide" transparent visible onRequestClose={onClose}><View style={styles.modalOverlay}><View style={styles.detailSheet}><ScrollView showsVerticalScrollIndicator={false}>{dream.image_uri ? <Image source={{ uri: dream.image_uri }} style={styles.detailImage} /> : <View style={styles.detailImageFallback}><Text style={styles.detailImageFallbackText}>✦</Text></View>}<Text style={styles.detailTitle}>{dream.title}</Text><Text style={styles.detailDate}>{timing}</Text><View style={styles.detailAmounts}><View><Text style={styles.detailAmountLabel}>目標金額</Text><Text style={styles.detailAmountValue}>{money(dream.target_amount)}</Text></View><View><Text style={styles.detailAmountLabel}>目前累積</Text><Text style={styles.detailAmountValue}>{money(dream.saved_amount)}</Text></View></View><View style={styles.detailProgressHeader}><Text style={styles.detailProgressLabel}>目前進度</Text><Text style={styles.detailProgressPercent}>{percent}%</Text></View><View style={styles.detailProgressTrack}><View style={[styles.detailProgressFill, { width: `${percent}%` as `${number}%` }]} /></View><View style={[styles.encouragement, expired && styles.encouragementExpired]}><Text style={styles.encouragementIcon}>{expired ? '🌱' : '✨'}</Text><Text style={styles.encouragementText}>{expired ? '加油，再接再勵' : '加油，你的目標不遠了'}</Text></View><Pressable accessibilityRole="button" style={styles.detailCloseButton} onPress={onClose}><Text style={styles.buttonText}>關閉</Text></Pressable></ScrollView></View></View></Modal>;
}
function DreamForm(props: DreamsHomeProps) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pendingDate, setPendingDate] = useState(startOfToday());
  const openDatePicker = (): void => {
    setPendingDate(props.dreamTargetDate === '' ? startOfToday() : dateFromStorage(props.dreamTargetDate));
    setShowDatePicker(true);
  };
  const handleDateChange = (_event: DateTimePickerChangeEvent, selectedDate: Date): void => {
    setPendingDate(selectedDate);
    if (Platform.OS === 'android') {
      props.onSetTargetDate(dateStorageValue(selectedDate));
      setShowDatePicker(false);
    }
  };
  return <Modal animationType="slide" transparent visible={props.isFormOpen} onRequestClose={props.onCloseForm}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalKeyboardView}><View style={styles.modalOverlay}><View style={styles.modalSheet}><ScrollView contentContainerStyle={styles.modalScrollContent} keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}><Text style={styles.modalTitle}>新增夢想</Text><Text style={styles.modalDescription}>加入一張代表夢想的圖片，讓目標更有感。</Text><Text style={styles.fieldLabel}>夢想圖片</Text><Pressable accessibilityRole="button" style={styles.imagePicker} onPress={props.onPickImage}>{props.dreamImageUri ? <Image source={{ uri: props.dreamImageUri }} style={styles.imagePreview} /> : <View style={styles.imagePlaceholder}><Text style={styles.imagePlaceholderIcon}>＋</Text><Text style={styles.imagePlaceholderText}>從相簿選擇圖片</Text></View>}<View style={styles.imagePickerBadge}><Text style={styles.imagePickerBadgeText}>{props.dreamImageUri ? '更換圖片' : '選擇圖片'}</Text></View></Pressable><Text style={styles.fieldLabel}>夢想名稱</Text><TextInput autoFocus={!props.dreamImageUri} returnKeyType="next" placeholder="例如：2027 冰島旅行" placeholderTextColor="#9AA5B4" style={styles.modalInput} value={props.dreamTitle} onChangeText={props.onSetTitle} /><Text style={styles.fieldLabel}>目標金額</Text><TextInput keyboardType="numeric" returnKeyType="next" placeholder="例如：120,000" placeholderTextColor="#9AA5B4" style={styles.modalInput} value={props.dreamTarget} onChangeText={props.onSetTarget} /><Text style={styles.fieldLabel}>每月分配給這個夢想</Text><TextInput keyboardType="numeric" returnKeyType="done" placeholder="例如：5,000" placeholderTextColor="#9AA5B4" style={styles.modalInput} value={props.dreamAllocation} onChangeText={props.onSetAllocation} /><Text style={styles.fieldLabel}>預計達成日期（選填）</Text><View style={styles.dateFieldRow}><Pressable accessibilityRole="button" accessibilityLabel="選擇預計達成日期" style={styles.dateField} onPress={openDatePicker}><Text style={props.dreamTargetDate === '' ? styles.datePlaceholder : styles.dateValue}>{props.dreamTargetDate === '' ? '選擇日期' : dateDisplayValue(props.dreamTargetDate)}</Text><Text style={styles.dateCalendarIcon}>▣</Text></Pressable>{props.dreamTargetDate !== '' && <Pressable accessibilityLabel="清除預計達成日期" style={styles.dateClearButton} onPress={() => props.onSetTargetDate('')}><Text style={styles.dateClearText}>清除</Text></Pressable>}</View><Text style={styles.dateHint}>未選擇日期時，將依每月投入金額估算達成時間。</Text>{showDatePicker && <View style={styles.datePickerPanel}><DateTimePicker display="spinner" locale="zh-TW" minimumDate={startOfToday()} mode="date" onDismiss={() => setShowDatePicker(false)} onValueChange={handleDateChange} value={pendingDate} />{Platform.OS === 'ios' && <View style={styles.datePickerActions}><Pressable style={styles.datePickerCancel} onPress={() => setShowDatePicker(false)}><Text style={styles.datePickerCancelText}>取消</Text></Pressable><Pressable style={styles.datePickerConfirm} onPress={() => { props.onSetTargetDate(dateStorageValue(pendingDate)); setShowDatePicker(false); }}><Text style={styles.datePickerConfirmText}>完成</Text></Pressable></View>}</View>}<Pressable disabled={props.isSaving} style={[styles.modalPrimaryButton, props.isSaving && styles.disabled]} onPress={props.onSaveDream}>{props.isSaving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>建立夢想</Text>}</Pressable><Pressable style={styles.modalCancelButton} onPress={props.onCloseForm}><Text style={styles.modalCancelText}>取消</Text></Pressable></ScrollView></View></View></KeyboardAvoidingView></Modal>;
}

type OnboardingProps = {
  step: Step; assets: ReadonlyArray<Item>; liabilities: ReadonlyArray<Item>; income: ReadonlyArray<Item>; expenses: ReadonlyArray<Item>; saving: boolean;
  onUpdate: (kind: EntryKind, id: string, field: 'category' | 'amount', value: string) => void;
  onAdd: (kind: 'income' | 'expense') => void; onNext: (target: Step, items: ReadonlyArray<Item>) => void; onSave: () => void; onFinish: () => void;
};
function Onboarding(props: OnboardingProps) {
  if (props.step === 'welcome') return (
    <View style={styles.welcome}>
      <StatusBar style="dark" />
      <ImageBackground
        source={require('./assets/welcome-journey.png')}
        resizeMode="cover"
        style={styles.welcomeBackground}
      >
        <View style={styles.welcomeCopy}>
          <Text style={styles.welcomeTitle}>讓夢想</Text>
          <Text style={styles.welcomeTitle}>有財務力量</Text>
          <Text style={styles.welcomeDescription}>一步步盤點財務現況，</Text>
          <Text style={styles.welcomeDescriptionLine}>打造實現夢想的計畫。</Text>
        </View>
        <View style={styles.welcomeFooter}>
          <Pressable
            accessibilityRole="button"
            style={styles.welcomeButton}
            onPress={() => props.onNext('assets', [])}
          >
            <Text style={styles.buttonText}>開始盤點我的財務</Text>
          </Pressable>
          <Text style={styles.note}>所有資料只保存在這台裝置內</Text>
        </View>
      </ImageBackground>
    </View>
  );
  const screen = screenFor(props);
  const progressWidth = (screen.number * 20 + '%') as `${number}%`;
  const isBalanceSheetStep = props.step === 'assets' || props.step === 'liabilities';
  const isCashFlowStep = props.step === 'income' || props.step === 'expenses';
  const hasFixedFooter = isBalanceSheetStep || isCashFlowStep;
  const actionButton = <Pressable disabled={props.saving} style={[styles.button, props.saving && styles.disabled]} onPress={screen.action}>{props.saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>{screen.button}</Text>}</Pressable>;
  const cashFlowItems = props.step === 'income' ? props.income : props.expenses;
  const cashFlowKind = props.step === 'income' ? 'income' : 'expense';
  const cashFlowAddButton = isCashFlowStep && cashFlowItems.length < 10 && <Pressable style={styles.add} onPress={() => props.onAdd(cashFlowKind)}><Text style={styles.addText}>＋ 新增一個項目</Text></Pressable>;
  const fixedFooter = isBalanceSheetStep || isCashFlowStep ? <>{cashFlowAddButton}<Text style={styles.helper}>暫時沒有的項目可填 0；之後可隨時回來調整。</Text>{actionButton}</> : null;
  if (isCashFlowStep) return <View style={styles.container}><StatusBar style="dark" /><View style={styles.cashFlowScreenContent}><Text style={styles.progress}>步驟 {screen.number} / 5</Text><View style={styles.track}><View style={[styles.trackValue, { width: progressWidth }]} /></View><Text style={styles.title}>{screen.title}</Text><Text style={styles.description}>{screen.description}</Text><EntryForm items={screen.items} kind={screen.kind} canAdd={false} onUpdate={props.onUpdate} onAdd={props.onAdd} /></View><View style={styles.fixedFooter}>{fixedFooter}</View></View>;
  return <View style={styles.container}><StatusBar style="dark" /><ScrollView style={styles.onboardingScroll} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled"><Text style={styles.progress}>步驟 {screen.number} / 5</Text><View style={styles.track}><View style={[styles.trackValue, { width: progressWidth }]} /></View><Text style={styles.title}>{screen.title}</Text><Text style={styles.description}>{screen.description}</Text>{props.step === 'summary' ? <Summary assets={props.assets} liabilities={props.liabilities} income={props.income} expenses={props.expenses} /> : <EntryForm items={screen.items} kind={screen.kind} canAdd={props.step === 'expenses'} onUpdate={props.onUpdate} onAdd={props.onAdd} />}{!hasFixedFooter && actionButton}</ScrollView>{fixedFooter !== null && <View style={styles.fixedFooter}>{fixedFooter}</View>}</View>;
}
function screenFor(props: OnboardingProps): { number: number; title: string; description: string; items: ReadonlyArray<Item>; kind: EntryKind; button: string; action: () => void } {
  if (props.step === 'assets') return { number: 1, title: '盤點我的資產', description: '列出你擁有的資產，幫助你掌握財務全貌。', items: props.assets, kind: 'asset', button: '下一步', action: () => props.onNext('liabilities', props.assets) };
  if (props.step === 'liabilities') return { number: 2, title: '盤點我的負債', description: '了解負債狀況，才能更有規劃地走向未來。', items: props.liabilities, kind: 'liability', button: '下一步', action: () => props.onNext('income', props.liabilities) };
  if (props.step === 'income') return { number: 3, title: '我的每月固定收入', description: '記錄每月穩定的收入來源與金額。', items: props.income, kind: 'income', button: '下一步', action: () => props.onNext('expenses', props.income) };
  if (props.step === 'expenses') return { number: 4, title: '我的每月固定支出', description: '記錄每月固定支出，掌握真正可運用的資源。', items: props.expenses, kind: 'expense', button: '查看財務摘要', action: props.onSave };
  return { number: 5, title: '你的財務摘要', description: '完成盤點！這是你目前的財務狀況。', items: [], kind: 'asset', button: '開始我的財務計畫', action: props.onFinish };
}
function EntryForm({ items, kind, canAdd, onUpdate, onAdd }: { items: ReadonlyArray<Item>; kind: EntryKind; canAdd: boolean; onUpdate: OnboardingProps['onUpdate']; onAdd: OnboardingProps['onAdd'] }) {
  const totalLabel = kind === 'asset' ? '資產總計' : kind === 'liability' ? '負債總計' : kind === 'income' ? '每月固定收入總計' : kind === 'expense' ? '每月固定支出總計' : null;
  const isCashFlow = kind === 'income' || kind === 'expense';
  const canAddMore = !isCashFlow || items.length < 10;
  const totalCard = totalLabel !== null && <View style={styles.entryTotal}><Text style={styles.entryTotalLabel}>{totalLabel}</Text><Text accessibilityLiveRegion="polite" style={styles.entryTotalValue}>{money(total(items))}</Text></View>;
  const entryRows = items.map((item) => <View key={item.id} style={styles.entry}><TextInput value={item.category} style={styles.category} placeholder="收入／支出分類" placeholderTextColor="#9AA5B4" onChangeText={(value) => onUpdate(kind, item.id, 'category', value)} /><TextInput value={item.amount} style={styles.amount} placeholder="金額（NT$）" placeholderTextColor="#9AA5B4" keyboardType="numeric" onChangeText={(value) => onUpdate(kind, item.id, 'amount', value)} /></View>);
  const addButton = canAdd && canAddMore && <Pressable style={styles.add} onPress={() => onAdd(kind === 'income' ? 'income' : 'expense')}><Text style={styles.addText}>＋ 新增一個項目</Text></Pressable>;
  if (isCashFlow) return <View style={[styles.form, styles.cashFlowForm]}>{totalCard}<View style={styles.cashFlowFlowBlock}><ScrollView nestedScrollEnabled style={styles.cashFlowFlowItems} contentContainerStyle={styles.cashFlowItemsContent} keyboardShouldPersistTaps="handled">{entryRows}</ScrollView>{addButton}<Text style={styles.itemLimit}>最多可新增 10 個{kind === 'income' ? '收入' : '支出'}項目（目前 {items.length} 個）</Text></View></View>;
  return <View style={styles.form}>{totalCard}{entryRows}{addButton}</View>;
}
function Summary({ assets, liabilities, income, expenses }: Pick<OnboardingProps, 'assets' | 'liabilities' | 'income' | 'expenses'>) {
  const assetTotal = total(assets); const liabilityTotal = total(liabilities); const incomeTotal = total(income); const expenseTotal = total(expenses);
  return <View style={styles.summary}><View style={styles.net}><Text style={styles.netLabel}>淨資產</Text><Text style={styles.netValue}>{money(assetTotal - liabilityTotal)}</Text></View><Row label="資產總額" value={assetTotal} /><Row label="負債總額" value={liabilityTotal} /><Row label="每月固定收入" value={incomeTotal} /><Row label="每月固定支出" value={expenseTotal} /><Row label="每月結餘" value={incomeTotal - expenseTotal} highlight /></View>;
}
function Row({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) { return <View style={styles.row}><Text style={[styles.rowText, highlight && styles.highlight]}>{label}</Text><Text style={[styles.rowValue, highlight && styles.highlight]}>{money(value)}</Text></View>; }

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FCFAF5' }, center: { alignItems: 'center', backgroundColor: '#FCFAF5', flex: 1, justifyContent: 'center' }, content: { flex: 1, padding: 24, paddingTop: 34 }, title: { color: '#132442', fontSize: 29, fontWeight: '700', marginTop: 24 }, description: { color: '#617085', fontSize: 15, lineHeight: 23, marginTop: 10 }, mainCard: { backgroundColor: '#087A50', borderRadius: 18, marginTop: 20, padding: 22 }, mainCardText: { color: '#FFFFFF', fontSize: 22, fontWeight: '700' }, tabBar: { backgroundColor: '#FFFFFF', borderTopColor: '#EAE6DE', borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', paddingBottom: 10, paddingTop: 8 }, tab: { alignItems: 'center', flex: 1 }, icon: { color: '#718096', fontSize: 18 }, tabText: { color: '#718096', fontSize: 12, marginTop: 3 }, active: { color: '#087A50', fontWeight: '700' },
  welcome: { backgroundColor: '#FBF8F0', flex: 1 }, welcomeBackground: { flex: 1, justifyContent: 'space-between' }, welcomeCopy: { paddingHorizontal: 28, paddingTop: 72 }, welcomeTitle: { color: '#102548', fontSize: 38, fontWeight: '800', letterSpacing: 0.2, lineHeight: 48 }, welcomeDescription: { color: '#33445B', fontSize: 17, lineHeight: 27, marginTop: 22 }, welcomeDescriptionLine: { color: '#33445B', fontSize: 17, lineHeight: 27 }, welcomeFooter: { paddingBottom: 24, paddingHorizontal: 20 }, welcomeButton: { alignItems: 'center', backgroundColor: '#075B35', borderRadius: 12, justifyContent: 'center', minHeight: 56, shadowColor: '#0A3324', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.16, shadowRadius: 9 }, note: { color: '#34455B', fontSize: 13, marginTop: 16, textAlign: 'center' },
  onboardingScroll: { flex: 1 }, scroll: { flexGrow: 1, padding: 24, paddingBottom: 24, paddingTop: 34 }, cashFlowScreenContent: { flex: 1, paddingBottom: 10, paddingHorizontal: 24, paddingTop: 34 }, progress: { color: '#718096', fontSize: 13, marginTop: 12 }, track: { backgroundColor: '#E5E9E6', borderRadius: 99, height: 6, marginTop: 9, overflow: 'hidden' }, trackValue: { backgroundColor: '#087A50', borderRadius: 99, height: '100%' }, form: { marginTop: 28 }, cashFlowForm: { flex: 1, minHeight: 0 }, cashFlowFlowBlock: { flex: 1, minHeight: 0, overflow: 'hidden' }, cashFlowFlowItems: { flex: 1 }, cashFlowItemsContent: { paddingBottom: 2 }, entry: { flexDirection: 'row', gap: 8, marginBottom: 12 }, category: { backgroundColor: '#FFFFFF', borderColor: '#DDE3E8', borderRadius: 12, borderWidth: 1, color: '#132442', flex: 1.25, minHeight: 52, paddingHorizontal: 12 }, amount: { backgroundColor: '#FFFFFF', borderColor: '#DDE3E8', borderRadius: 12, borderWidth: 1, color: '#132442', flex: 1, minHeight: 52, paddingHorizontal: 12 }, entryTotal: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#E2E6E3', borderRadius: 12, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, paddingHorizontal: 16, paddingVertical: 17 }, entryTotalLabel: { color: '#132442', fontSize: 16, fontWeight: '700' }, entryTotalValue: { color: '#075B35', fontSize: 19, fontWeight: '800' }, add: { alignItems: 'center', borderColor: '#8ABFA7', borderRadius: 12, borderWidth: 1, justifyContent: 'center', minHeight: 48 }, addText: { color: '#087A50', fontWeight: '700' }, itemLimit: { color: '#718096', fontSize: 12, marginTop: 10, textAlign: 'right' }, helper: { color: '#718096', fontSize: 13, lineHeight: 19, marginTop: 12 },
  summary: { backgroundColor: '#FFFFFF', borderRadius: 16, marginTop: 28, overflow: 'hidden' }, net: { backgroundColor: '#EAF6EF', padding: 18 }, netLabel: { color: '#176342', fontSize: 14 }, netValue: { color: '#07583A', fontSize: 28, fontWeight: '800', marginTop: 6 }, row: { borderTopColor: '#E7EAE7', borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', justifyContent: 'space-between', padding: 16 }, rowText: { color: '#526277', fontSize: 15 }, rowValue: { color: '#132442', fontSize: 15, fontWeight: '700' }, highlight: { color: '#087A50', fontWeight: '800' },
  dreamsContent: { padding: 24, paddingBottom: 28, paddingTop: 58 }, dreamsTitle: { color: '#132442', fontSize: 30, fontWeight: '800' }, availableCard: { backgroundColor: '#087A50', borderRadius: 18, marginTop: 18, padding: 18 }, availableLabel: { color: '#D9F3E5', fontSize: 14 }, availableValue: { color: '#FFFFFF', fontSize: 30, fontWeight: '800', marginTop: 5 }, availableDetail: { color: '#D9F3E5', fontSize: 13, marginTop: 7 }, dreamsSectionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 24, marginBottom: 10 }, dreamsSectionTitle: { color: '#132442', fontSize: 17, fontWeight: '700' }, dreamCount: { color: '#718096', fontSize: 13 }, emptyDreams: { backgroundColor: '#FFFFFF', borderColor: '#E2E6E3', borderRadius: 16, borderWidth: 1, padding: 20 }, emptyDreamsTitle: { color: '#132442', fontSize: 16, fontWeight: '700' }, emptyDreamsText: { color: '#617085', fontSize: 14, lineHeight: 21, marginTop: 8 }, createDreamButton: { alignItems: 'center', borderColor: '#2B966A', borderRadius: 13, borderStyle: 'dashed', borderWidth: 1, justifyContent: 'center', marginTop: 14, minHeight: 52 }, createDreamButtonText: { color: '#087A50', fontSize: 15, fontWeight: '700' }, dreamCard: { backgroundColor: '#FFFFFF', borderRadius: 16, flexDirection: 'row', marginBottom: 10, padding: 14 }, dreamIcon: { alignItems: 'center', backgroundColor: '#0B5F54', borderRadius: 13, height: 62, justifyContent: 'center', width: 62 }, dreamIconText: { color: '#FFFFFF', fontSize: 24 }, dreamImage: { borderRadius: 13, height: 62, width: 62 }, dreamMeta: { flex: 1, marginLeft: 12 }, dreamTitleLine: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, dreamName: { color: '#132442', flex: 1, fontSize: 16, fontWeight: '700', marginRight: 8 }, dreamPercent: { color: '#087A50', fontSize: 14, fontWeight: '800' }, dreamDetail: { color: '#617085', fontSize: 12, marginTop: 4 }, dreamProgressTrack: { backgroundColor: '#E6ECE7', borderRadius: 99, height: 7, marginTop: 8, overflow: 'hidden' }, dreamProgressFill: { backgroundColor: '#087A50', borderRadius: 99, height: '100%' }, dreamTiming: { color: '#617085', fontSize: 11, marginTop: 7 }, modalKeyboardView: { flex: 1 }, modalOverlay: { backgroundColor: 'rgba(19, 36, 66, 0.35)', flex: 1, justifyContent: 'flex-end' }, modalSheet: { backgroundColor: '#FCFAF5', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%', overflow: 'hidden' }, modalScrollContent: { padding: 24, paddingBottom: 34 }, modalTitle: { color: '#132442', fontSize: 24, fontWeight: '800' }, modalDescription: { color: '#617085', fontSize: 14, lineHeight: 21, marginTop: 7 }, fieldLabel: { color: '#2F4058', fontSize: 14, fontWeight: '700', marginTop: 20, marginBottom: 8 }, imagePicker: { backgroundColor: '#FFFFFF', borderColor: '#DDE3E8', borderRadius: 14, borderWidth: 1, height: 150, overflow: 'hidden', position: 'relative' }, imagePreview: { height: '100%', width: '100%' }, imagePlaceholder: { alignItems: 'center', flex: 1, justifyContent: 'center' }, imagePlaceholderIcon: { color: '#087A50', fontSize: 28, fontWeight: '500' }, imagePlaceholderText: { color: '#617085', fontSize: 13, marginTop: 5 }, imagePickerBadge: { backgroundColor: 'rgba(7, 91, 53, 0.9)', borderRadius: 9, bottom: 10, paddingHorizontal: 11, paddingVertical: 7, position: 'absolute', right: 10 }, imagePickerBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' }, modalInput: { backgroundColor: '#FFFFFF', borderColor: '#DDE3E8', borderRadius: 12, borderWidth: 1, color: '#132442', fontSize: 16, minHeight: 52, paddingHorizontal: 14 }, modalPrimaryButton: { alignItems: 'center', backgroundColor: '#087A50', borderRadius: 14, justifyContent: 'center', marginTop: 24, minHeight: 54 }, modalCancelButton: { alignItems: 'center', justifyContent: 'center', minHeight: 46, marginTop: 6 }, modalCancelText: { color: '#526277', fontSize: 15, fontWeight: '700' },
  dreamCardPressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  dateHint: { color: '#718096', fontSize: 11, marginTop: 7 },
  dateFieldRow: { alignItems: 'center', flexDirection: 'row', gap: 9 },
  dateField: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#DDE3E8', borderRadius: 12, borderWidth: 1, flex: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 52, paddingHorizontal: 14 },
  datePlaceholder: { color: '#9AA5B4', fontSize: 16 },
  dateValue: { color: '#132442', fontSize: 16 },
  dateCalendarIcon: { color: '#087A50', fontSize: 18 },
  dateClearButton: { alignItems: 'center', borderColor: '#DDE3E8', borderRadius: 12, borderWidth: 1, justifyContent: 'center', minHeight: 52, paddingHorizontal: 13 },
  dateClearText: { color: '#617085', fontSize: 13, fontWeight: '700' },
  datePickerPanel: { backgroundColor: '#FFFFFF', borderColor: '#E1E6E2', borderRadius: 14, borderWidth: 1, marginTop: 10, overflow: 'hidden' },
  datePickerActions: { borderTopColor: '#E7EAE7', borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 10, padding: 10 },
  datePickerCancel: { alignItems: 'center', borderColor: '#DDE3E8', borderRadius: 10, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 42 },
  datePickerCancelText: { color: '#617085', fontSize: 14, fontWeight: '700' },
  datePickerConfirm: { alignItems: 'center', backgroundColor: '#087A50', borderRadius: 10, flex: 1, justifyContent: 'center', minHeight: 42 },
  datePickerConfirmText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  detailSheet: { backgroundColor: '#FCFAF5', borderTopLeftRadius: 26, borderTopRightRadius: 26, maxHeight: '90%', overflow: 'hidden', padding: 24, paddingBottom: 34 },
  detailImage: { borderRadius: 18, height: 220, width: '100%' },
  detailImageFallback: { alignItems: 'center', backgroundColor: '#0B5F54', borderRadius: 18, height: 180, justifyContent: 'center', width: '100%' },
  detailImageFallbackText: { color: '#FFFFFF', fontSize: 52 },
  detailTitle: { color: '#132442', fontSize: 24, fontWeight: '800', marginTop: 19 },
  detailDate: { color: '#617085', fontSize: 13, marginTop: 7 },
  detailAmounts: { backgroundColor: '#FFFFFF', borderRadius: 15, flexDirection: 'row', justifyContent: 'space-between', marginTop: 18, padding: 16 },
  detailAmountLabel: { color: '#718096', fontSize: 11 },
  detailAmountValue: { color: '#132442', fontSize: 17, fontWeight: '800', marginTop: 4 },
  detailProgressHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 21 },
  detailProgressLabel: { color: '#2F4058', fontSize: 14, fontWeight: '700' },
  detailProgressPercent: { color: '#087A50', fontSize: 16, fontWeight: '800' },
  detailProgressTrack: { backgroundColor: '#E3EAE5', borderRadius: 99, height: 11, marginTop: 9, overflow: 'hidden' },
  detailProgressFill: { backgroundColor: '#087A50', borderRadius: 99, height: '100%' },
  encouragement: { alignItems: 'center', backgroundColor: '#EAF5ED', borderRadius: 15, flexDirection: 'row', marginTop: 16, padding: 14 },
  encouragementExpired: { backgroundColor: '#FFF1DE' },
  encouragementIcon: { fontSize: 22, marginRight: 9 },
  encouragementText: { color: '#265A43', fontSize: 15, fontWeight: '700' },
  detailCloseButton: { alignItems: 'center', backgroundColor: '#087A50', borderRadius: 14, justifyContent: 'center', marginTop: 22, minHeight: 52 },
  fixedFooter: { backgroundColor: '#FCFAF5', borderTopColor: '#E5E9E6', borderTopWidth: StyleSheet.hairlineWidth, paddingBottom: 16, paddingHorizontal: 24, paddingTop: 12 }, button: { alignItems: 'center', backgroundColor: '#087A50', borderRadius: 14, justifyContent: 'center', marginTop: 16, minHeight: 54 }, disabled: { backgroundColor: '#70A992' }, buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  resetButton: { alignItems: 'center', borderColor: '#C55252', borderRadius: 12, borderWidth: 1, marginTop: 28, minHeight: 50, justifyContent: 'center' }, resetButtonText: { color: '#A53B3B', fontSize: 15, fontWeight: '700' },
  pageContent: { padding: 24, paddingBottom: 30, paddingTop: 58 },
  pageHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  pageTitle: { color: '#132442', fontSize: 28, fontWeight: '800' },
  pageSubtitle: { color: '#617085', fontSize: 13, marginTop: 5 },
  headerAction: { alignItems: 'center', backgroundColor: '#F0EDE6', borderRadius: 18, justifyContent: 'center', minHeight: 36, paddingHorizontal: 13 },
  headerActionText: { color: '#087A50', fontSize: 13, fontWeight: '700' },
  balanceCard: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 18, flexDirection: 'row', marginTop: 18, padding: 14 },
  donutWrap: { alignItems: 'center', height: 118, justifyContent: 'center', position: 'relative', width: 118 },
  donutLabel: { alignItems: 'center', bottom: 0, justifyContent: 'center', left: 0, position: 'absolute', right: 0, top: 0 },
  donutCaption: { color: '#617085', fontSize: 10 },
  donutValue: { color: '#132442', fontSize: 13, fontWeight: '800', marginTop: 2 },
  balanceLegend: { flex: 1, marginLeft: 10 },
  cardTitle: { color: '#132442', fontSize: 14, fontWeight: '700', marginBottom: 7 },
  legendRow: { alignItems: 'center', flexDirection: 'row', marginTop: 8 },
  legendDot: { borderRadius: 4, height: 8, marginRight: 7, width: 8 },
  legendLabel: { color: '#526277', flex: 1, fontSize: 11 },
  legendValue: { color: '#132442', fontSize: 10, fontWeight: '700' },
  sectionHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, marginTop: 18 },
  sectionHeadingText: { color: '#132442', fontSize: 15, fontWeight: '800' },
  sectionCaption: { color: '#718096', fontSize: 11 },
  financeList: { backgroundColor: '#FFFFFF', borderRadius: 16, overflow: 'hidden' },
  financeRow: { alignItems: 'center', borderBottomColor: '#EEEAE2', borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', minHeight: 51, paddingHorizontal: 12 },
  financeRowIcon: { alignItems: 'center', backgroundColor: '#E8F3EB', borderRadius: 9, height: 29, justifyContent: 'center', width: 29 },
  financeRowIconText: { color: '#087A50', fontSize: 13, fontWeight: '800' },
  financeRowName: { color: '#273952', flex: 1, fontSize: 13, fontWeight: '600', marginLeft: 10 },
  financeRowAmount: { fontSize: 13, fontWeight: '800' },
  financeRowPressed: { backgroundColor: '#F1F6F2' },
  financeRowChevron: { color: '#8B98A8', fontSize: 19, marginLeft: 8 },
  financeAddButton: { alignItems: 'center', borderColor: '#2B966A', borderRadius: 13, borderStyle: 'dashed', borderWidth: 1, justifyContent: 'center', marginTop: 20, minHeight: 52 },
  financeAddButtonText: { color: '#087A50', fontSize: 15, fontWeight: '700' },
  financeTypeSelector: { backgroundColor: '#E9EDE9', borderRadius: 13, flexDirection: 'row', gap: 5, padding: 5 },
  financeTypeOption: { alignItems: 'center', borderRadius: 9, flex: 1, justifyContent: 'center', minHeight: 44 },
  financeTypeOptionActive: { backgroundColor: '#FFFFFF', shadowColor: '#132442', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 5 },
  financeTypeOptionText: { color: '#718096', fontSize: 14, fontWeight: '700' },
  financeTypeOptionTextActive: { color: '#087A50' },
  investableRow: { alignItems: 'center', backgroundColor: '#EAF5ED', borderRadius: 14, flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, padding: 14 },
  investableLabel: { color: '#176342', fontSize: 13, fontWeight: '600' },
  investableValue: { color: '#075B35', fontSize: 16, fontWeight: '800' },
  calendarLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 17 },
  monthSelectButton: { alignItems: 'center', backgroundColor: '#F0EDE6', borderRadius: 18, flexDirection: 'row', minHeight: 38, paddingHorizontal: 13 },
  monthSelectText: { color: '#273952', fontSize: 13, fontWeight: '700' },
  monthSelectChevron: { color: '#087A50', fontSize: 16, marginLeft: 6 },
  legendChip: { alignItems: 'center', flexDirection: 'row' },
  legendChipText: { color: '#617085', fontSize: 11 },
  calendarCard: { backgroundColor: '#FFFFFF', borderRadius: 18, marginTop: 12, padding: 12 },
  weekRow: { flexDirection: 'row' },
  weekText: { color: '#718096', flex: 1, fontSize: 11, textAlign: 'center' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },
  calendarDay: { alignItems: 'center', height: 43, justifyContent: 'center', position: 'relative', width: '14.2857%' },
  calendarDayWithTotals: { height: 62, justifyContent: 'flex-start', paddingTop: 6 },
  calendarDayText: { color: '#34455B', fontSize: 12 },
  calendarToday: { borderColor: '#87B99B', borderRadius: 11, borderWidth: 1 },
  calendarTodayText: { color: '#087A50', fontWeight: '800' },
  calendarSelected: { backgroundColor: MACARON_YELLOW, borderColor: '#E7C765', borderRadius: 11, borderWidth: 1 },
  calendarSelectedText: { color: '#6A5214', fontWeight: '800' },
  calendarMark: { borderRadius: 3, bottom: 4, height: 4, position: 'absolute', width: 18 },
  fixedCalendarMark: { borderRadius: 3, bottom: 3, height: 4, left: 8, position: 'absolute', width: 13 },
  fixedCalendarMarkSecond: { left: undefined, right: 8 },
  calendarIncomeAmount: { color: '#087A50', fontSize: 8, fontWeight: '700', marginTop: 3, maxWidth: '92%' },
  calendarExpenseAmount: { color: '#B94743', fontSize: 8, fontWeight: '700', marginTop: 1, maxWidth: '92%' },
  activityTitle: { color: '#687589', fontSize: 12, fontWeight: '700', marginBottom: 8, marginTop: 20 },
  eventRow: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 14, flexDirection: 'row', marginBottom: 8, padding: 12 },
  eventDate: { alignItems: 'center', borderRadius: 9, justifyContent: 'center', minHeight: 32, minWidth: 44 },
  eventDateText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  eventLabel: { color: '#273952', flex: 1, fontSize: 13, fontWeight: '600', marginLeft: 10 },
  eventValue: { fontSize: 13, fontWeight: '800' },
  transactionList: { backgroundColor: '#FFFFFF', borderRadius: 15, overflow: 'hidden' },
  emptyTransactionText: { color: '#8A96A5', fontSize: 13, padding: 16, textAlign: 'center' },
  transactionRow: { alignItems: 'center', borderBottomColor: '#EEEAE2', borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', minHeight: 60, paddingHorizontal: 13 },
  transactionKindDot: { borderRadius: 5, height: 10, marginRight: 10, width: 10 },
  transactionCopy: { flex: 1 },
  transactionCategory: { color: '#273952', fontSize: 13, fontWeight: '700' },
  transactionNote: { color: '#718096', fontSize: 10, marginTop: 3 },
  transactionAmount: { fontSize: 12, fontWeight: '800', marginLeft: 8 },
  fixedFinanceGrid: { flexDirection: 'row', gap: 10 },
  fixedFinanceCard: { backgroundColor: '#FFFFFF', borderRadius: 15, borderTopWidth: 6, flex: 1, padding: 13 },
  fixedFinanceCardHeader: { alignItems: 'center', flexDirection: 'row' },
  fixedFinanceSwatch: { borderRadius: 5, height: 10, marginRight: 7, width: 10 },
  fixedFinanceLabel: { color: '#526277', fontSize: 12, fontWeight: '700' },
  fixedFinanceAmount: { color: '#132442', fontSize: 15, fontWeight: '800', marginTop: 9 },
  fixedFinanceDate: { color: '#8995A4', fontSize: 10, marginTop: 5 },
  pickerSheet: { backgroundColor: '#FCFAF5', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 34 },
  yearMonthPickers: { flexDirection: 'row', marginTop: 8 },
  yearMonthPicker: { flex: 1 },
  categoryPickerBox: { backgroundColor: '#FFFFFF', borderColor: '#DDE3E8', borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  noteInput: { minHeight: 96, paddingTop: 14, textAlignVertical: 'top' },
  profileHeader: { alignItems: 'center', flexDirection: 'row', marginTop: 22 },
  profileAvatar: { alignItems: 'center', backgroundColor: '#087A50', borderRadius: 29, height: 58, justifyContent: 'center', marginRight: 13, width: 58 },
  profileAvatarText: { color: '#FFFFFF', fontSize: 21, fontWeight: '800' },
  profileName: { color: '#132442', fontSize: 19, fontWeight: '800' },
  profileSummaryCard: { backgroundColor: '#EAF5ED', borderRadius: 16, flexDirection: 'row', justifyContent: 'space-around', marginTop: 20, padding: 16 },
  profileSummaryLabel: { color: '#4D6D5E', fontSize: 11 },
  profileSummaryValue: { color: '#075B35', fontSize: 16, fontWeight: '800', marginTop: 4 },
  profileSummaryDivider: { backgroundColor: '#C9DFD0', width: StyleSheet.hairlineWidth },
  profileRow: { alignItems: 'center', backgroundColor: '#FFFFFF', borderBottomColor: '#EEEAE2', borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', minHeight: 60, paddingHorizontal: 13 },
  profileRowIcon: { alignItems: 'center', backgroundColor: '#EEF2ED', borderRadius: 9, height: 31, justifyContent: 'center', width: 31 },
  profileRowIconText: { color: '#087A50', fontSize: 14, fontWeight: '800' },
  profileRowCopy: { flex: 1, marginLeft: 11 },
  profileRowTitle: { color: '#273952', fontSize: 14, fontWeight: '700' },
  profileRowDetail: { color: '#718096', fontSize: 11, marginTop: 3 },
  profileColorSwatch: { borderColor: '#FFFFFF', borderRadius: 9, borderWidth: 2, height: 18, marginRight: 9, width: 18 },
  profileChevron: { color: '#8B98A8', fontSize: 20 },
  colorPalette: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 8, marginTop: 20 },
  colorOption: { alignItems: 'center', borderColor: 'transparent', borderRadius: 25, borderWidth: 3, height: 50, justifyContent: 'center', width: 50 },
  colorOptionSelected: { borderColor: '#132442' },
  colorCheck: { color: '#132442', fontSize: 20, fontWeight: '900' },
});
