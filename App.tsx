import { StatusBar } from 'expo-status-bar';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ImageBackground, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

type TabKey = 'dreams' | 'finance' | 'calendar' | 'profile';
type Step = 'welcome' | 'assets' | 'liabilities' | 'income' | 'expenses' | 'summary';
type EntryKind = 'asset' | 'liability' | 'income' | 'expense';
type Item = { id: string; category: string; amount: string };
type RecordItem = { kind: EntryKind; category: string; amount: number };
type ProfileRow = { onboarding_complete: number };

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
    CREATE TABLE IF NOT EXISTS financial_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL CHECK (kind IN ('asset','liability','income','expense')), category TEXT NOT NULL, amount REAL NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);`);
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
function total(items: ReadonlyArray<Item>): number { return items.reduce((sum, item) => sum + (amount(item.amount) ?? 0), 0); }
function money(value: number): string { return 'NT$' + Math.round(value).toLocaleString('zh-TW'); }
function valid(items: ReadonlyArray<Item>): boolean { return items.every((item) => item.category.trim() !== '' && amount(item.amount) !== null); }
function fillEmptyAmountsWithZero(items: ReadonlyArray<Item>): ReadonlyArray<Item> {
  return items.map((item) => ({ ...item, amount: item.amount.trim() === '' ? '0' : item.amount }));
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

  useEffect(() => {
    let mounted = true;
    const load = async (): Promise<void> => {
      try {
        const db = await database();
        const profile = await db.getFirstAsync<ProfileRow>('SELECT onboarding_complete FROM profile WHERE id = 1');
        if (mounted && profile?.onboarding_complete === 1) setComplete(true);
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
    try { const db = await database(); await db.runAsync('UPDATE profile SET onboarding_complete = 1 WHERE id = 1'); setComplete(true); }
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

  if (loading) return <View style={styles.center}><ActivityIndicator color="#087A50" size="large" /></View>;
  if (!complete) return <Onboarding step={step} assets={assets} liabilities={liabilities} income={income} expenses={expenses} saving={saving} onUpdate={update} onAdd={add} onNext={next} onSave={save} onFinish={finish} />;
  const current = { dreams: ['我的夢想', '開始建立第一個夢想與目標金額。'], finance: ['資產負債表', '可隨時更新資產、負債與固定收支。'], calendar: ['資源日曆', '開始建立固定支出或夢想提撥。'], profile: ['我的', '個人設定將在下一階段完成。'] }[activeTab];
  return <View style={styles.container}><StatusBar style="dark" /><View style={styles.content}><Text style={styles.title}>{current[0]}</Text><View style={styles.mainCard}><Text style={styles.mainCardText}>本機資料已建立</Text></View><Text style={styles.description}>{current[1]}</Text>{__DEV__ && activeTab === 'profile' && <Pressable disabled={saving} style={styles.resetButton} onPress={resetTestData}><Text style={styles.resetButtonText}>重設測試資料</Text></Pressable>}</View><View style={styles.tabBar}>{tabs.map((tab) => <Pressable key={tab.key} onPress={() => setActiveTab(tab.key)} style={styles.tab}><Text style={[styles.icon, activeTab === tab.key && styles.active]}>{tab.icon}</Text><Text style={[styles.tabText, activeTab === tab.key && styles.active]}>{tab.label}</Text></Pressable>)}</View></View>;
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
  fixedFooter: { backgroundColor: '#FCFAF5', borderTopColor: '#E5E9E6', borderTopWidth: StyleSheet.hairlineWidth, paddingBottom: 16, paddingHorizontal: 24, paddingTop: 12 }, button: { alignItems: 'center', backgroundColor: '#087A50', borderRadius: 14, justifyContent: 'center', marginTop: 16, minHeight: 54 }, disabled: { backgroundColor: '#70A992' }, buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  resetButton: { alignItems: 'center', borderColor: '#C55252', borderRadius: 12, borderWidth: 1, marginTop: 28, minHeight: 50, justifyContent: 'center' }, resetButtonText: { color: '#A53B3B', fontSize: 15, fontWeight: '700' },
});
