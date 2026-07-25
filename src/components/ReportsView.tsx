import React, { useState, useMemo } from 'react';
import { Transaction, Expense, Product, StoreSettings, User, Category } from '../types';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  Download,
  Printer,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  ShoppingCart,
  Package,
  RefreshCw,
  Receipt,
  DollarSign,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  Tag,
  User as UserIcon,
  Clock,
  Boxes,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  Award,
  Activity
} from 'lucide-react';

interface ReportsViewProps {
  transactions: Transaction[];
  expenses: Expense[];
  products: Product[];
  categories?: Category[];
  settings: StoreSettings;
  currentUser?: User;
}

type PeriodFilterType = 'today' | 'this_week' | 'this_month' | 'custom';
type MainTabType = 'overview' | 'sales' | 'inventory' | 'expenses';
type ComparisonType = 'today_vs_yesterday' | 'this_week_vs_last_week' | 'this_month_vs_last_month' | 'this_year_vs_last_year';

export const ReportsView: React.FC<ReportsViewProps> = ({
  transactions,
  expenses,
  products,
  categories = [],
  settings,
  currentUser,
}) => {
  // Today's ISO date string helper (YYYY-MM-DD)
  const getTodayISO = () => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  };

  const todayStr = getTodayISO();

  // State
  const [periodFilter, setPeriodFilter] = useState<PeriodFilterType>('this_month');
  const [customFrom, setCustomFrom] = useState<string>(() => {
    const d = new Date();
    d.setDate(1); // 1st of current month
    return d.toISOString().split('T')[0];
  });
  const [customTo, setCustomTo] = useState<string>(todayStr);

  // Active applied dates
  const [appliedFrom, setAppliedFrom] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [appliedTo, setAppliedTo] = useState<string>(todayStr);

  const [activeTab, setActiveTab] = useState<MainTabType>('overview');
  const [salesTrendGrouping, setSalesTrendGrouping] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');
  const [comparisonType, setComparisonType] = useState<ComparisonType>('this_month_vs_last_month');
  
  // Sub tabs / filters
  const [inventorySubTab, setInventorySubTab] = useState<'fast' | 'slow' | 'low_stock' | 'out_of_stock' | 'all'>('all');
  const [salesSubTab, setSalesSubTab] = useState<'breakdown' | 'by_product' | 'by_category' | 'by_payment' | 'transactions'>('breakdown');
  
  // Search & Pagination
  const [inventorySearch, setInventorySearch] = useState<string>('');
  const [inventoryPage, setInventoryPage] = useState<number>(1);
  const itemsPerPage = 8;

  // Selected date modal for transaction drilldown
  const [selectedDrilldownDate, setSelectedDrilldownDate] = useState<string | null>(null);

  // Handle period change
  const handlePeriodChange = (filter: PeriodFilterType) => {
    setPeriodFilter(filter);
    const now = new Date();
    let from = todayStr;
    let to = todayStr;

    if (filter === 'today') {
      from = todayStr;
      to = todayStr;
    } else if (filter === 'this_week') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
      const monday = new Date(now.setDate(diff));
      from = monday.toISOString().split('T')[0];
      to = todayStr;
    } else if (filter === 'this_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      from = firstDay.toISOString().split('T')[0];
      to = todayStr;
    } else if (filter === 'custom') {
      from = customFrom;
      to = customTo;
    }

    setAppliedFrom(from);
    setAppliedTo(to);
  };

  const handleApplyCustomDate = () => {
    if (customFrom && customTo) {
      setAppliedFrom(customFrom);
      setAppliedTo(customTo);
    }
  };

  // Helper date extractors
  const getDateFromTimestamp = (ts: string) => {
    if (!ts) return '';
    return ts.split(' ')[0]; // Assumes 'YYYY-MM-DD HH:MM AM/PM'
  };

  // 1. FILTERED DATA
  const completedTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (t.status !== 'completed') return false;
      const tDate = getDateFromTimestamp(t.timestamp);
      return tDate >= appliedFrom && tDate <= appliedTo;
    });
  }, [transactions, appliedFrom, appliedTo]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      return e.date >= appliedFrom && e.date <= appliedTo;
    });
  }, [expenses, appliedFrom, appliedTo]);

  // Financial Metrics
  const totalSales = useMemo(() => completedTransactions.reduce((s, t) => s + t.grandTotal, 0), [completedTransactions]);
  const totalTxCount = completedTransactions.length;
  const avgTxValue = totalTxCount > 0 ? totalSales / totalTxCount : 0;
  const totalCogs = useMemo(() => completedTransactions.reduce((s, t) => s + t.totalCost, 0), [completedTransactions]);
  const grossProfit = totalSales - totalCogs;
  const totalExpensesAmount = useMemo(() => filteredExpenses.reduce((s, e) => s + e.amount, 0), [filteredExpenses]);
  const netProfit = grossProfit - totalExpensesAmount;
  const profitMargin = totalSales > 0 ? (netProfit / totalSales) * 100 : 0;

  // Category map helper
  const categoryMap = useMemo(() => {
    const map: { [id: string]: string } = {};
    categories.forEach((c) => {
      map[c.id] = c.name;
    });
    return map;
  }, [categories]);

  // Product map helper
  const productMap = useMemo(() => {
    const map: { [id: string]: Product } = {};
    products.forEach((p) => {
      map[p.id] = p;
    });
    return map;
  }, [products]);

  // Inventory Metrics
  const totalProducts = products.length;
  const activeProducts = products.filter((p) => p.status === 'active');
  const inactiveProducts = products.filter((p) => p.status === 'archived');
  const totalUnitsInStock = activeProducts.reduce((s, p) => s + p.currentStock, 0);
  const lowStockProducts = activeProducts.filter((p) => p.currentStock > 0 && p.currentStock <= p.reorderLevel);
  const outOfStockProducts = activeProducts.filter((p) => p.currentStock <= 0);

  const inventoryCostValue = activeProducts.reduce((s, p) => s + p.currentStock * p.costPrice, 0);
  const inventorySellingValue = activeProducts.reduce((s, p) => s + p.currentStock * p.sellingPrice, 0);
  const estimatedInventoryProfit = inventorySellingValue - inventoryCostValue;

  // Payment Method Breakdown
  const paymentBreakdown = useMemo(() => {
    let cashAmount = 0;
    let cashCount = 0;
    let gcashAmount = 0;
    let gcashCount = 0;

    completedTransactions.forEach((t) => {
      if (t.paymentMethod === 'cash') {
        cashAmount += t.grandTotal;
        cashCount += 1;
      } else if (t.paymentMethod === 'gcash') {
        gcashAmount += t.grandTotal;
        gcashCount += 1;
      }
    });

    const totalAmount = cashAmount + gcashAmount;
    const cashPct = totalAmount > 0 ? (cashAmount / totalAmount) * 100 : 0;
    const gcashPct = totalAmount > 0 ? (gcashAmount / totalAmount) * 100 : 0;

    return {
      cashAmount,
      cashCount,
      cashPct,
      gcashAmount,
      gcashCount,
      gcashPct,
    };
  }, [completedTransactions]);

  // Sales By Product Calculation
  const productSalesData = useMemo(() => {
    const salesMap: {
      [productId: string]: {
        product: Product | null;
        name: string;
        categoryName: string;
        unitsSold: number;
        revenue: number;
        grossProfit: number;
        lastSaleDate: string;
      };
    } = {};

    // Initialize all active products with 0 sales
    products.forEach((p) => {
      const catName = categoryMap[p.categoryId] || 'Motorcycle Parts';
      salesMap[p.id] = {
        product: p,
        name: p.name,
        categoryName: catName,
        unitsSold: 0,
        revenue: 0,
        grossProfit: 0,
        lastSaleDate: 'No Sales in Period',
      };
    });

    completedTransactions.forEach((t) => {
      const tDate = getDateFromTimestamp(t.timestamp);
      t.items.forEach((item) => {
        if (!salesMap[item.productId]) {
          salesMap[item.productId] = {
            product: productMap[item.productId] || null,
            name: item.productName,
            categoryName: 'Motorcycle Parts',
            unitsSold: 0,
            revenue: 0,
            grossProfit: 0,
            lastSaleDate: tDate,
          };
        }
        salesMap[item.productId].unitsSold += item.quantity;
        salesMap[item.productId].revenue += item.subtotal;
        const itemProfit = item.subtotal - item.costPrice * item.quantity;
        salesMap[item.productId].grossProfit += itemProfit;
        if (salesMap[item.productId].lastSaleDate === 'No Sales in Period' || tDate > salesMap[item.productId].lastSaleDate) {
          salesMap[item.productId].lastSaleDate = tDate;
        }
      });
    });

    return Object.values(salesMap);
  }, [completedTransactions, products, categoryMap, productMap]);

  // Category Sales Breakdown
  const categorySalesData = useMemo(() => {
    const catSales: {
      [catName: string]: {
        catName: string;
        unitsSold: number;
        revenue: number;
        grossProfit: number;
      };
    } = {};

    completedTransactions.forEach((t) => {
      t.items.forEach((item) => {
        const prod = productMap[item.productId];
        const cName = prod ? (categoryMap[prod.categoryId] || 'Uncategorized Parts') : 'Motorcycle Parts';
        
        if (!catSales[cName]) {
          catSales[cName] = { catName: cName, unitsSold: 0, revenue: 0, grossProfit: 0 };
        }
        catSales[cName].unitsSold += item.quantity;
        catSales[cName].revenue += item.subtotal;
        catSales[cName].grossProfit += (item.subtotal - item.costPrice * item.quantity);
      });
    });

    const totalCatRevenue = Object.values(catSales).reduce((s, c) => s + c.revenue, 0);

    return Object.values(catSales).map((c) => ({
      ...c,
      percentage: totalCatRevenue > 0 ? (c.revenue / totalCatRevenue) * 100 : 0,
    })).sort((a, b) => b.revenue - a.revenue);
  }, [completedTransactions, productMap, categoryMap]);

  // Expenses By Category Breakdown
  const expenseCategoryData = useMemo(() => {
    const expMap: { [cat: string]: number } = {};
    filteredExpenses.forEach((e) => {
      expMap[e.category] = (expMap[e.category] || 0) + e.amount;
    });

    const totalExp = Object.values(expMap).reduce((s, a) => s + a, 0);

    return Object.entries(expMap).map(([category, amount]) => ({
      category,
      amount,
      percentage: totalExp > 0 ? (amount / totalExp) * 100 : 0,
    })).sort((a, b) => b.amount - a.amount);
  }, [filteredExpenses]);

  // Daily/Periodical Sales Breakdown Table
  const periodSalesTable = useMemo(() => {
    const daysMap: {
      [dateStr: string]: {
        date: string;
        txCount: number;
        grossSales: number;
        cogs: number;
        grossProfit: number;
        expenses: number;
        netProfit: number;
      };
    } = {};

    completedTransactions.forEach((t) => {
      const d = getDateFromTimestamp(t.timestamp);
      if (!daysMap[d]) {
        daysMap[d] = {
          date: d,
          txCount: 0,
          grossSales: 0,
          cogs: 0,
          grossProfit: 0,
          expenses: 0,
          netProfit: 0,
        };
      }
      daysMap[d].txCount += 1;
      daysMap[d].grossSales += t.grandTotal;
      daysMap[d].cogs += t.totalCost;
      daysMap[d].grossProfit += t.estimatedProfit;
    });

    filteredExpenses.forEach((e) => {
      const d = e.date;
      if (!daysMap[d]) {
        daysMap[d] = {
          date: d,
          txCount: 0,
          grossSales: 0,
          cogs: 0,
          grossProfit: 0,
          expenses: 0,
          netProfit: 0,
        };
      }
      daysMap[d].expenses += e.amount;
    });

    return Object.values(daysMap)
      .map((item) => ({
        ...item,
        netProfit: item.grossProfit - item.expenses,
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [completedTransactions, filteredExpenses]);

  // Period Comparison Metrics Calculation
  const comparisonData = useMemo(() => {
    // Current period metrics
    const currentSales = totalSales;
    const currentTxCount = totalTxCount;
    const currentProfit = grossProfit;
    const currentExpenses = totalExpensesAmount;
    const currentNetProfit = netProfit;

    // Calculate previous period dates
    const fromD = new Date(appliedFrom);
    const toD = new Date(appliedTo);
    const timeDiff = toD.getTime() - fromD.getTime();
    const daysCount = Math.max(1, Math.round(timeDiff / (1000 * 3600 * 24)) + 1);

    const prevToD = new Date(fromD.getTime() - (1000 * 3600 * 24));
    const prevFromD = new Date(prevToD.getTime() - (1000 * 3600 * 24 * (daysCount - 1)));

    const prevFromStr = prevFromD.toISOString().split('T')[0];
    const prevToStr = prevToD.toISOString().split('T')[0];

    const prevTx = transactions.filter((t) => {
      if (t.status !== 'completed') return false;
      const tDate = getDateFromTimestamp(t.timestamp);
      return tDate >= prevFromStr && tDate <= prevToStr;
    });

    const prevExp = expenses.filter((e) => e.date >= prevFromStr && e.date <= prevToStr);

    const prevSales = prevTx.reduce((s, t) => s + t.grandTotal, 0);
    const prevTxCount = prevTx.length;
    const prevCogs = prevTx.reduce((s, t) => s + t.totalCost, 0);
    const prevProfit = prevSales - prevCogs;
    const prevExpensesAmount = prevExp.reduce((s, e) => s + e.amount, 0);
    const prevNetProfit = prevProfit - prevExpensesAmount;

    const calcChange = (curr: number, prev: number) => {
      const diff = curr - prev;
      const pct = prev > 0 ? (diff / prev) * 100 : (curr > 0 ? 100 : 0);
      return { diff, pct };
    };

    return {
      prevFromStr,
      prevToStr,
      sales: { current: currentSales, prev: prevSales, ...calcChange(currentSales, prevSales) },
      txCount: { current: currentTxCount, prev: prevTxCount, ...calcChange(currentTxCount, prevTxCount) },
      grossProfit: { current: currentProfit, prev: prevProfit, ...calcChange(currentProfit, prevProfit) },
      expenses: { current: currentExpenses, prev: prevExpensesAmount, ...calcChange(currentExpenses, prevExpensesAmount) },
      netProfit: { current: currentNetProfit, prev: prevNetProfit, ...calcChange(currentNetProfit, prevNetProfit) },
    };
  }, [appliedFrom, appliedTo, totalSales, totalTxCount, grossProfit, totalExpensesAmount, netProfit, transactions, expenses]);

  // Automated Insights Engine (Strictly calculated from data)
  const businessInsights = useMemo(() => {
    const list: { text: string; type: 'success' | 'warning' | 'info' }[] = [];

    // 1. Sales Trend
    if (comparisonData.sales.diff > 0) {
      list.push({
        text: `Sales increased by ${settings.currencySymbol}${comparisonData.sales.diff.toLocaleString('en-PH', { minimumFractionDigits: 2 })} (+${comparisonData.sales.pct.toFixed(1)}%) compared to the previous period.`,
        type: 'success',
      });
    } else if (comparisonData.sales.diff < 0) {
      list.push({
        text: `Sales decreased by ${settings.currencySymbol}${Math.abs(comparisonData.sales.diff).toLocaleString('en-PH', { minimumFractionDigits: 2 })} (${comparisonData.sales.pct.toFixed(1)}%) compared to the previous period.`,
        type: 'warning',
      });
    } else {
      list.push({
        text: `Sales remained stable with no change compared to the previous period.`,
        type: 'info',
      });
    }

    // 2. Net Profit vs Expenses
    if (comparisonData.expenses.diff > 0 && comparisonData.netProfit.diff < 0) {
      list.push({
        text: `Net profit decreased because shop overhead expenses increased by ${settings.currencySymbol}${comparisonData.expenses.diff.toLocaleString('en-PH', { minimumFractionDigits: 2 })}.`,
        type: 'warning',
      });
    } else if (netProfit > 0) {
      list.push({
        text: `Store generated a healthy net profit of ${settings.currencySymbol}${netProfit.toLocaleString('en-PH', { minimumFractionDigits: 2 })} with a profit margin of ${profitMargin.toFixed(1)}%.`,
        type: 'success',
      });
    }

    // 3. Top Product Category
    if (categorySalesData.length > 0) {
      const topCat = categorySalesData[0];
      list.push({
        text: `${topCat.catName} generated the highest revenue (${settings.currencySymbol}${topCat.revenue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}, ${topCat.percentage.toFixed(1)}% of total sales).`,
        type: 'info',
      });
    }

    // 4. Payment Preference
    if (paymentBreakdown.cashPct > paymentBreakdown.gcashPct && paymentBreakdown.cashAmount > 0) {
      list.push({
        text: `Cash was the primary payment method, accounting for ${paymentBreakdown.cashPct.toFixed(1)}% of total sales (${settings.currencySymbol}${paymentBreakdown.cashAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}).`,
        type: 'info',
      });
    } else if (paymentBreakdown.gcashPct > 0) {
      list.push({
        text: `GCash was the most popular payment method, representing ${paymentBreakdown.gcashPct.toFixed(1)}% of overall transactions.`,
        type: 'info',
      });
    }

    // 5. Stock Warnings
    if (lowStockProducts.length > 0 || outOfStockProducts.length > 0) {
      list.push({
        text: `${lowStockProducts.length} product(s) are low in stock and ${outOfStockProducts.length} item(s) are completely out of stock.`,
        type: 'warning',
      });
    }

    // 6. Unsold Items
    const zeroSalesCount = productSalesData.filter((p) => p.unitsSold === 0).length;
    if (zeroSalesCount > 0) {
      list.push({
        text: `${zeroSalesCount} active motorcycle item(s) recorded zero sales during the selected period.`,
        type: 'warning',
      });
    }

    return list;
  }, [comparisonData, settings.currencySymbol, netProfit, profitMargin, categorySalesData, paymentBreakdown, lowStockProducts, outOfStockProducts, productSalesData]);

  // Inventory Table Filtered and Paginated
  const filteredInventoryList = useMemo(() => {
    let list = productSalesData;

    if (inventorySubTab === 'fast') {
      list = [...list].sort((a, b) => b.unitsSold - a.unitsSold);
    } else if (inventorySubTab === 'slow') {
      list = [...list].sort((a, b) => a.unitsSold - b.unitsSold);
    } else if (inventorySubTab === 'low_stock') {
      list = list.filter((p) => p.product && p.product.currentStock > 0 && p.product.currentStock <= p.product.reorderLevel);
    } else if (inventorySubTab === 'out_of_stock') {
      list = list.filter((p) => p.product && p.product.currentStock <= 0);
    }

    if (inventorySearch.trim()) {
      const query = inventorySearch.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.categoryName.toLowerCase().includes(query) ||
          (p.product && p.product.sku.toLowerCase().includes(query))
      );
    }

    return list;
  }, [productSalesData, inventorySubTab, inventorySearch]);

  const totalInventoryPages = Math.ceil(filteredInventoryList.length / itemsPerPage) || 1;
  const paginatedInventoryList = useMemo(() => {
    const start = (inventoryPage - 1) * itemsPerPage;
    return filteredInventoryList.slice(start, start + itemsPerPage);
  }, [filteredInventoryList, inventoryPage]);

  // Transaction Drilldown Modal List
  const drilldownTransactions = useMemo(() => {
    if (!selectedDrilldownDate) return [];
    return completedTransactions.filter((t) => getDateFromTimestamp(t.timestamp) === selectedDrilldownDate);
  }, [completedTransactions, selectedDrilldownDate]);

  // Export CSV Function
  const exportToCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += `Mags Moto - ${settings.storeName}\n`;
    csvContent += `Report Title: Business & Financial Report (${activeTab.toUpperCase()})\n`;
    csvContent += `Reporting Period: ${appliedFrom} to ${appliedTo}\n`;
    csvContent += `Generated On: ${new Date().toLocaleString('en-PH')}\n`;
    csvContent += `Generated By: ${currentUser ? currentUser.name : 'System User'}\n\n`;

    if (activeTab === 'overview' || activeTab === 'sales') {
      csvContent += `Financial Overview Summary\n`;
      csvContent += `Total Sales,${totalSales.toFixed(2)}\n`;
      csvContent += `Total Transactions,${totalTxCount}\n`;
      csvContent += `Average Transaction Value,${avgTxValue.toFixed(2)}\n`;
      csvContent += `Cost of Goods Sold (COGS),${totalCogs.toFixed(2)}\n`;
      csvContent += `Gross Profit,${grossProfit.toFixed(2)}\n`;
      csvContent += `Total Expenses,${totalExpensesAmount.toFixed(2)}\n`;
      csvContent += `Net Profit,${netProfit.toFixed(2)}\n`;
      csvContent += `Profit Margin %,${profitMargin.toFixed(2)}%\n\n`;

      csvContent += `Daily Sales Breakdown Table\n`;
      csvContent += `Date,Transactions,Gross Sales,COGS,Gross Profit,Expenses,Net Profit\n`;
      periodSalesTable.forEach((row) => {
        csvContent += `${row.date},${row.txCount},${row.grossSales.toFixed(2)},${row.cogs.toFixed(2)},${row.grossProfit.toFixed(2)},${row.expenses.toFixed(2)},${row.netProfit.toFixed(2)}\n`;
      });
    } else if (activeTab === 'inventory') {
      csvContent += `Inventory Summary\n`;
      csvContent += `Total Products,${totalProducts}\n`;
      csvContent += `Units in Stock,${totalUnitsInStock}\n`;
      csvContent += `Low Stock Count,${lowStockProducts.length}\n`;
      csvContent += `Out of Stock Count,${outOfStockProducts.length}\n`;
      csvContent += `Total Inventory Cost Value,${inventoryCostValue.toFixed(2)}\n`;
      csvContent += `Potential Selling Value,${inventorySellingValue.toFixed(2)}\n\n`;

      csvContent += `Product Stock & Performance Report\n`;
      csvContent += `Product Name,Category,Units Sold,Current Stock,Sales Revenue,Last Sale Date\n`;
      productSalesData.forEach((row) => {
        const stockStr = row.product ? row.product.currentStock : 'N/A';
        csvContent += `"${row.name.replace(/"/g, '""')}",${row.categoryName},${row.unitsSold},${stockStr},${row.revenue.toFixed(2)},${row.lastSaleDate}\n`;
      });
    } else if (activeTab === 'expenses') {
      csvContent += `Expense History\n`;
      csvContent += `Date,Category,Description,Amount,Recorded By\n`;
      filteredExpenses.forEach((exp) => {
        csvContent += `${exp.date},"${exp.category}","${exp.description.replace(/"/g, '""')}",${exp.amount.toFixed(2)},${exp.recordedBy}\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `MagsMoto_Report_${activeTab}_${appliedFrom}_to_${appliedTo}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print PDF View Handler
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12">
      {/* HEADER BAR */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-6 print:border-none print:shadow-none print:bg-white print:text-slate-900">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-600/30">
              <BarChart3 className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white print:text-slate-900">
                Business Reports and Analytics
              </h1>
              <p className="text-xs text-slate-400 mt-0.5 print:text-slate-600 font-medium">
                Monitor sales, profit, expenses, inventory performance, and business growth.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls: Export & Print */}
        <div className="flex flex-wrap items-center gap-2.5 print:hidden">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export CSV / Excel</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-600/20 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print PDF Report</span>
          </button>
        </div>
      </div>

      {/* PRINT-ONLY OFFICIAL HEADER */}
      <div className="hidden print:block p-6 border-b border-slate-300 mb-6 space-y-2">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-black text-slate-900">{settings.storeName}</h1>
            <p className="text-xs text-slate-600">{settings.address || 'Motorcycle Parts & Accessories System'}</p>
            <p className="text-xs text-slate-600">{settings.phone} • {settings.email}</p>
          </div>
          <div className="text-right text-xs text-slate-600">
            <p className="font-bold text-slate-900">OFFICIAL BUSINESS REPORT</p>
            <p>Period: {appliedFrom} to {appliedTo}</p>
            <p>Generated On: {new Date().toLocaleString('en-PH')}</p>
            <p>Generated By: {currentUser?.name || 'System Owner'}</p>
          </div>
        </div>
      </div>

      {/* PERIOD FILTER CONTROL BAR */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3 print:hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <Filter className="w-4 h-4 text-blue-600" />
            <span>Report Period Filter:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {[
              { key: 'today', label: 'Today' },
              { key: 'this_week', label: 'This Week' },
              { key: 'this_month', label: 'This Month' },
              { key: 'custom', label: 'Custom Range' },
            ].map((p) => (
              <button
                key={p.key}
                onClick={() => handlePeriodChange(p.key as PeriodFilterType)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  periodFilter === p.key
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Date Inputs */}
        {periodFilter === 'custom' && (
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-3 animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-500">From:</label>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="p-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-500">To:</label>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="p-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              onClick={handleApplyCustomDate}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer"
            >
              Generate Report
            </button>
          </div>
        )}

        {/* Active Applied Date Range Notice */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
          <span>Active Reporting Period: <strong className="text-slate-900">{appliedFrom}</strong> to <strong className="text-slate-900">{appliedTo}</strong></span>
          <span className="text-blue-600">{completedTransactions.length} Sales Transactions Found</span>
        </div>
      </div>

      {/* REPORT NAVIGATION TABS */}
      <div className="flex items-center space-x-2 border-b border-slate-200 overflow-x-auto pb-1 scrollbar-none print:hidden">
        {[
          { id: 'overview', label: 'Overview', icon: LayoutDashboard },
          { id: 'sales', label: 'Sales', icon: ShoppingCart },
          { id: 'inventory', label: 'Inventory', icon: Package },
          { id: 'expenses', label: 'Expenses', icon: DollarSign },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as MainTabType)}
              className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-500'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Summary Financial Cards Grid (6 Cards) */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Total Sales */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">Total Sales</span>
                <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                  <ShoppingCart className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-black text-slate-900">
                {settings.currencySymbol}{totalSales.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] text-slate-400 font-semibold">{totalTxCount} Completed Sales</p>
            </div>

            {/* Total Transactions */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">Total Transactions</span>
                <div className="w-8 h-8 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
                  <Receipt className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-black text-slate-900">{totalTxCount}</p>
              <p className="text-[11px] text-slate-400 font-semibold">Store Checkouts</p>
            </div>

            {/* Cost of Goods Sold */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">Cost of Goods Sold (COGS)</span>
                <div className="w-8 h-8 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                  <Boxes className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-black text-slate-900">
                {settings.currencySymbol}{totalCogs.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] text-slate-400 font-semibold">Parts Acquisition Cost</p>
            </div>

            {/* Gross Profit */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">Gross Profit</span>
                <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-black text-emerald-600">
                {settings.currencySymbol}{grossProfit.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] text-emerald-600 font-semibold">Sales minus Cost of Goods</p>
            </div>

            {/* Total Expenses */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">Total Expenses</span>
                <div className="w-8 h-8 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-black text-rose-600">
                {settings.currencySymbol}{totalExpensesAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] text-slate-400 font-semibold">Overhead & Utilities</p>
            </div>

            {/* Net Profit */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">Net Profit</span>
                <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                  <Award className="w-4 h-4" />
                </div>
              </div>
              <p className={`text-2xl font-black ${netProfit >= 0 ? 'text-blue-700' : 'text-rose-600'}`}>
                {settings.currencySymbol}{netProfit.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] text-slate-400 font-semibold">Gross Profit minus Expenses</p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SALES TAB */}
      {activeTab === 'sales' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Payment Method Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Cash Payment Card */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-slate-800 text-sm">Cash Payments</span>
                <div className="w-8 h-8 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center font-black text-sm">
                  ₱
                </div>
              </div>
              <p className="text-2xl font-black text-slate-900">
                {settings.currencySymbol}{paymentBreakdown.cashAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </p>
              <div className="flex justify-between text-xs font-bold text-slate-500">
                <span>{paymentBreakdown.cashCount} Checkouts</span>
                <span className="text-emerald-600 font-extrabold">{paymentBreakdown.cashPct.toFixed(1)}% of Sales</span>
              </div>
            </div>

            {/* GCash Payment Card */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-slate-800 text-sm">GCash Payments</span>
                <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-xl flex items-center justify-center">
                  <CreditCard className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-black text-slate-900">
                {settings.currencySymbol}{paymentBreakdown.gcashAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </p>
              <div className="flex justify-between text-xs font-bold text-slate-500">
                <span>{paymentBreakdown.gcashCount} Checkouts</span>
                <span className="text-blue-600 font-extrabold">{paymentBreakdown.gcashPct.toFixed(1)}% of Sales</span>
              </div>
            </div>
          </div>

          {/* Sales Performance Table Container */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">Sales Performance Table</h3>
                <p className="text-xs text-slate-500">Click any date row to view transactions for that day.</p>
              </div>
              <div className="text-xs text-slate-400 font-semibold">
                Showing {periodSalesTable.length} recorded dates
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-900 text-white font-bold rounded-xl">
                    <th className="p-3 rounded-l-xl">Date</th>
                    <th className="p-3 text-center">Transactions</th>
                    <th className="p-3 text-right">Gross Sales</th>
                    <th className="p-3 text-right">COGS</th>
                    <th className="p-3 text-right">Gross Profit</th>
                    <th className="p-3 text-right">Expenses</th>
                    <th className="p-3 text-right rounded-r-xl">Net Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {periodSalesTable.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-400 font-bold">
                        No sales recorded in the selected date range.
                      </td>
                    </tr>
                  ) : (
                    periodSalesTable.map((row) => (
                      <tr
                        key={row.date}
                        onClick={() => setSelectedDrilldownDate(row.date)}
                        className="hover:bg-blue-50/60 cursor-pointer transition-colors"
                      >
                        <td className="p-3 font-extrabold text-slate-900 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-blue-600" />
                          <span>{row.date}</span>
                        </td>
                        <td className="p-3 text-center font-bold text-slate-800">{row.txCount}</td>
                        <td className="p-3 text-right font-bold text-slate-900">
                          {settings.currencySymbol}{row.grossSales.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-right font-medium text-slate-500">
                          {settings.currencySymbol}{row.cogs.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-right font-bold text-emerald-600">
                          {settings.currencySymbol}{row.grossProfit.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-right font-medium text-rose-600">
                          {settings.currencySymbol}{row.expenses.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </td>
                        <td className={`p-3 text-right font-black ${row.netProfit >= 0 ? 'text-blue-700' : 'text-rose-600'}`}>
                          {settings.currencySymbol}{row.netProfit.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: INVENTORY TAB */}
      {activeTab === 'inventory' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Inventory Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-xs font-bold text-slate-500">Total Products</span>
              <p className="text-2xl font-black text-slate-900">{totalProducts}</p>
              <p className="text-[11px] text-slate-400 font-semibold">{activeProducts.length} Active Catalog</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-xs font-bold text-slate-500">Units in Stock</span>
              <p className="text-2xl font-black text-slate-900">{totalUnitsInStock}</p>
              <p className="text-[11px] text-slate-400 font-semibold">Total Stock On-Hand</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-xs font-bold text-amber-600">Low-Stock Items</span>
              <p className="text-2xl font-black text-amber-600">{lowStockProducts.length}</p>
              <p className="text-[11px] text-amber-600 font-semibold">At/Below Reorder Level</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-xs font-bold text-rose-600">Out-of-Stock</span>
              <p className="text-2xl font-black text-rose-600">{outOfStockProducts.length}</p>
              <p className="text-[11px] text-rose-600 font-semibold">0 Quantity Remaining</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-xs font-bold text-slate-500">Inventory Cost Value</span>
              <p className="text-2xl font-black text-slate-900">
                {settings.currencySymbol}{inventoryCostValue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] text-slate-400 font-semibold">Sum of (Stock × Cost)</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-xs font-bold text-slate-500">Potential Selling Value</span>
              <p className="text-2xl font-black text-blue-600">
                {settings.currencySymbol}{inventorySellingValue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] text-blue-600 font-semibold">Sum of (Stock × Price)</p>
            </div>
          </div>

          {/* Sub-reports Filter & Search */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { id: 'all', label: 'All Products' },
                  { id: 'fast', label: 'Fast-Moving Products' },
                  { id: 'slow', label: 'Slow-Moving Products' },
                  { id: 'low_stock', label: `Low Stock (${lowStockProducts.length})` },
                  { id: 'out_of_stock', label: `Out of Stock (${outOfStockProducts.length})` },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setInventorySubTab(tab.id as any);
                      setInventoryPage(1);
                    }}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                      inventorySubTab === tab.id
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search product or SKU..."
                  value={inventorySearch}
                  onChange={(e) => {
                    setInventorySearch(e.target.value);
                    setInventoryPage(1);
                  }}
                  className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64"
                />
              </div>
            </div>

            {/* Inventory Items Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-900 text-white font-bold">
                    <th className="p-3 rounded-l-xl">Product Name</th>
                    <th className="p-3">Category</th>
                    <th className="p-3 text-center">Units Sold</th>
                    <th className="p-3 text-center">Current Stock</th>
                    <th className="p-3 text-right">Sales Revenue</th>
                    <th className="p-3 text-right rounded-r-xl">Last Sale Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {paginatedInventoryList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-400 font-bold">
                        No inventory items found matching your filter.
                      </td>
                    </tr>
                  ) : (
                    paginatedInventoryList.map((item, idx) => {
                      const stockVal = item.product ? item.product.currentStock : 0;
                      const isLow = item.product && stockVal > 0 && stockVal <= item.product.reorderLevel;
                      const isOut = stockVal <= 0;

                      return (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-3">
                            <p className="font-bold text-slate-900">{item.name}</p>
                            {item.product && <p className="text-[10px] text-slate-400 font-mono">SKU: {item.product.sku}</p>}
                          </td>
                          <td className="p-3 text-slate-500">{item.categoryName}</td>
                          <td className="p-3 text-center font-bold text-blue-600">{item.unitsSold}</td>
                          <td className="p-3 text-center font-extrabold">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] ${
                                isOut
                                  ? 'bg-rose-100 text-rose-700'
                                  : isLow
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-emerald-100 text-emerald-700'
                              }`}
                            >
                              {stockVal} units
                            </span>
                          </td>
                          <td className="p-3 text-right font-bold text-slate-900">
                            {settings.currencySymbol}{item.revenue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-3 text-right text-slate-500">{item.lastSaleDate}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalInventoryPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-xs">
                <span className="text-slate-500 font-semibold">
                  Page {inventoryPage} of {totalInventoryPages} ({filteredInventoryList.length} total items)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={inventoryPage === 1}
                    onClick={() => setInventoryPage((p) => p - 1)}
                    className="p-2 border border-slate-200 rounded-xl disabled:opacity-40 hover:bg-slate-100 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    disabled={inventoryPage === totalInventoryPages}
                    onClick={() => setInventoryPage((p) => p + 1)}
                    className="p-2 border border-slate-200 rounded-xl disabled:opacity-40 hover:bg-slate-100 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: EXPENSES TAB */}
      {activeTab === 'expenses' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Expenses Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-xs font-bold text-slate-500">Total Period Expenses</span>
              <p className="text-3xl font-black text-rose-600">
                {settings.currencySymbol}{totalExpensesAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] text-slate-400 font-semibold">{filteredExpenses.length} Expense Logs Recorded</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-xs font-bold text-slate-500">Top Expense Category</span>
              <p className="text-xl font-black text-slate-900">
                {expenseCategoryData.length > 0 ? expenseCategoryData[0].category : 'None'}
              </p>
              <p className="text-[11px] text-slate-400 font-semibold">
                {expenseCategoryData.length > 0
                  ? `${settings.currencySymbol}${expenseCategoryData[0].amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })} (${expenseCategoryData[0].percentage.toFixed(1)}%)`
                  : 'No expenses'}
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-xs font-bold text-slate-500">Average Expense Entry</span>
              <p className="text-2xl font-black text-slate-900">
                {settings.currencySymbol}
                {(filteredExpenses.length > 0 ? totalExpensesAmount / filteredExpenses.length : 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] text-slate-400 font-semibold">Per Overhead Record</p>
            </div>
          </div>

          {/* Expenses Category Breakdown */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
            <h3 className="font-extrabold text-slate-900 text-base">Expense Breakdown by Category</h3>
            <div className="space-y-3">
              {expenseCategoryData.map((cat, idx) => (
                <div key={idx} className="space-y-1.5 p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-800">{cat.category}</span>
                    <span className="text-rose-600">
                      {settings.currencySymbol}{cat.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })} ({cat.percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-rose-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, cat.percentage)}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Expense Log History Table */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-extrabold text-slate-900 text-base">Expense History Table</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-900 text-white font-bold">
                    <th className="p-3 rounded-l-xl">Date</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Description</th>
                    <th className="p-3 text-right">Amount</th>
                    <th className="p-3 text-right rounded-r-xl">Recorded By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-slate-400 font-bold">
                        No expenses recorded in selected date range.
                      </td>
                    </tr>
                  ) : (
                    filteredExpenses.map((exp) => (
                      <tr key={exp.id} className="hover:bg-slate-50">
                        <td className="p-3 font-bold text-slate-900">{exp.date}</td>
                        <td className="p-3 font-semibold text-slate-700">{exp.category}</td>
                        <td className="p-3 text-slate-600">{exp.description}</td>
                        <td className="p-3 text-right font-extrabold text-rose-600">
                          {settings.currencySymbol}{exp.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-right text-slate-500">{exp.recordedBy}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TRANSACTION DRILLDOWN MODAL */}
      {selectedDrilldownDate && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl border border-slate-200 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  Transactions on {selectedDrilldownDate}
                </h3>
                <p className="text-xs text-slate-500">
                  {drilldownTransactions.length} completed sale(s) recorded on this date.
                </p>
              </div>
              <button
                onClick={() => setSelectedDrilldownDate(null)}
                className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {drilldownTransactions.map((tx) => (
                <div key={tx.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2 text-xs">
                  <div className="flex justify-between font-extrabold text-slate-900">
                    <span>{tx.receiptNumber}</span>
                    <span className="text-blue-600">{settings.currencySymbol}{tx.grandTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500 font-medium">
                    <span>Time: {tx.timestamp}</span>
                    <span>Cashier: {tx.cashierName}</span>
                    <span className="uppercase font-bold text-slate-700">Method: {tx.paymentMethod}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-200/60 space-y-1 text-[11px] text-slate-600">
                    {tx.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span>{item.quantity}x {item.productName}</span>
                        <span className="font-bold">{settings.currencySymbol}{item.subtotal.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedDrilldownDate(null)}
                className="px-5 py-2.5 bg-slate-900 text-white font-bold rounded-xl text-xs cursor-pointer"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
