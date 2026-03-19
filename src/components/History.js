'use client';
import { useState, useEffect, useMemo } from 'react';
import { useAccount, usePublicClient, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatUnits } from 'viem';
import { DEX_ADDRESS, DEX_ABI, TOKENS, formatTick, tickToPrice } from '@/config/web3';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

const TOKEN_LIST = Object.values(TOKENS);

function OrderRow({ order, currentNetworkId }) {
  const { data: cancelHash, isPending: isCancelSigning, writeContract } = useWriteContract();
  const { isLoading: isCancelConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: cancelHash });

  const isCancelling = isCancelSigning || isCancelConfirming;
  const isCancelled = isSuccess || order.status === 'Cancelled';

  const handleCancel = () => {
    writeContract({
      address: DEX_ADDRESS,
      abi: DEX_ABI,
      chainId: currentNetworkId,
      functionName: 'cancel',
      args: [order.id]
    });
  };

  const token = TOKEN_LIST.find(t => t.address.toLowerCase() === order.token.toLowerCase()) || { symbol: '???', decimals: 6 };
  const amnt = formatUnits(order.amount, token.decimals);
  const filled = formatUnits(order.amountFilled, token.decimals);
  const price = tickToPrice(order.tick).toFixed(4);
  const displayTick = formatTick(order.tick);
  
  const filledPct = order.amount > 0n ? Number((order.amountFilled * 100n) / order.amount) : 0;
  
  let statusColor = 'var(--text-dim)';
  let statusText = order.status;
  if (order.status === 'Active') {
    statusColor = 'var(--brand-primary)';
  } else if (order.status === 'Filled') {
    statusColor = 'var(--success)';
  } else if (order.status === 'Partially Filled') {
    statusColor = 'var(--warning)';
  }

  if (isCancelled) {
    statusColor = 'var(--danger)';
    statusText = 'Cancelled';
  }

  return (
    <div style={{ padding: '12px', background: 'var(--bg-panel)', borderRadius: '12px', border: '1px solid var(--border-light)', marginBottom: '8px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
      <div style={{ flex: '1 1 auto', minWidth: '150px' }}>
        <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px' }}>Order #{order.id.toString()}</div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, color: order.isBid ? 'var(--success)' : 'var(--danger)', fontSize: '14px' }}>
            {order.isBid ? 'BUY' : 'SELL'}
          </span>
          <span style={{ fontWeight: 600, fontSize: '14px' }}>{amnt} {token.symbol}</span>
        </div>
      </div>
      
      <div style={{ flex: '1 1 auto', minWidth: '120px' }}>
        <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px' }}>Price</div>
        <div style={{ fontSize: '13px', fontWeight: 600 }}>
          {price} <span style={{ color: 'var(--text-dim)', fontSize: '12px', fontWeight: 400 }}>pUSD</span>
        </div>
        <div style={{ fontSize: '10px', color: order.tick >= 0 ? 'var(--success)' : 'var(--danger)', marginTop: '2px' }}>Tick {displayTick}</div>
      </div>

      <div style={{ flex: '1 1 auto', minWidth: '120px' }}>
        <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px' }}>Status</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: statusColor }}></span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: statusColor }}>{statusText}</span>
        </div>
        {order.status !== 'Cancelled' && filledPct > 0 && <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>{filledPct}% Filled</div>}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', minWidth: '80px' }}>
        {(order.status === 'Active' || order.status === 'Partially Filled') && !isCancelled && (
          <button 
            onClick={handleCancel}
            disabled={isCancelling}
            style={{ padding: '6px 12px', fontSize: '12px', fontWeight: 600, background: 'rgba(255, 71, 87, 0.1)', color: 'var(--danger)', border: '1px solid rgba(255, 71, 87, 0.2)', borderRadius: '6px', cursor: isCancelling ? 'not-allowed' : 'pointer', transition: '0.2s' }}>
            {isCancelling ? '...' : 'Cancel'}
          </button>
        )}
      </div>
    </div>
  );
}

function SwapRow({ swap }) {
  return (
    <div style={{ padding: '12px', background: 'var(--bg-panel)', borderRadius: '12px', border: '1px solid var(--border-light)', marginBottom: '8px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
      <div style={{ flex: '1 1 auto', minWidth: '150px' }}>
        <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px' }}>Swap</div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: '14px' }}>{swap.amountIn} {swap.tokenIn}</span>
          <span style={{ color: 'var(--brand-primary)', fontSize: '14px' }}>→</span>
          <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--success)' }}>{swap.amountOut} {swap.tokenOut}</span>
        </div>
      </div>
      <div style={{ flex: '1 1 auto', minWidth: '100px', textAlign: 'right' }}>
        <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px' }}>Time</div>
        <div style={{ fontSize: '12px' }}>{new Date(swap.time).toLocaleString()}</div>
        <div style={{ marginTop: '4px' }}>
          <a href={`https://${swap.networkId === 4217 ? 'explore.tempo.xyz' : 'explore.testnet.tempo.xyz'}/tx/${swap.txHash}`} target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: 'var(--brand-primary)', textDecoration: 'none' }}>View Tx ↗</a>
        </div>
      </div>
    </div>
  );
}

export default function History({ currentNetworkId, onConnect }) {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: currentNetworkId });
  
  const [orders, setOrders] = useState([]);
  const [swaps, setSwaps] = useState([]);
  const [historyTab, setHistoryTab] = useState('orders'); // 'orders' or 'swaps'
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isConnected && address) {
      try {
        const stored = JSON.parse(localStorage.getItem('tempo_swaps') || '[]');
        const userSwaps = stored.filter(s => s.user === address && s.networkId === currentNetworkId);
        setSwaps(userSwaps);
      } catch (e) {}
    } else {
      setSwaps([]);
    }
  }, [isConnected, address, currentNetworkId]);

  useEffect(() => {
    if (!isConnected || !address || !publicClient) {
      setOrders([]);
      return;
    }

    let isMounted = true;

    async function fetchHistory() {
      setIsLoading(true);
      setError('');
      try {
        // Find ABI items
        const placeAbi = DEX_ABI.find(a => a.name === 'OrderPlaced' && a.type === 'event');
        const fillAbi = DEX_ABI.find(a => a.name === 'OrderFilled' && a.type === 'event');
        const cancelAbi = DEX_ABI.find(a => a.name === 'OrderCancelled' && a.type === 'event');

        // Fetch logs
        // Tempo Testnet RPC limits getLogs to 100,000 blocks at a time.
        // We will fetch the last 300,000 blocks (approx 3.5 days of history).
        const currentBlock = await publicClient.getBlockNumber();
        const CHUNK_SIZE = 99999n;
        const NUM_CHUNKS = 3n;
        const targetStart = currentBlock > (CHUNK_SIZE * NUM_CHUNKS) ? currentBlock - (CHUNK_SIZE * NUM_CHUNKS) : 0n;

        let allPlaced = [];
        let allFilled = [];
        let allCancelled = [];

        for (let start = targetStart; start <= currentBlock; start += CHUNK_SIZE + 1n) {
          const end = (start + CHUNK_SIZE > currentBlock) ? currentBlock : start + CHUNK_SIZE;
          const [placedLogs, filledLogs, cancelLogs] = await Promise.all([
            publicClient.getLogs({
              address: DEX_ADDRESS,
              event: placeAbi,
              args: { maker: address },
              fromBlock: start,
              toBlock: end
            }),
            publicClient.getLogs({
              address: DEX_ADDRESS,
              event: fillAbi,
              args: { maker: address },
              fromBlock: start,
              toBlock: end
            }),
            publicClient.getLogs({
              address: DEX_ADDRESS,
              event: cancelAbi,
              fromBlock: start,
              toBlock: end
            })
          ]);
          allPlaced = allPlaced.concat(placedLogs);
          allFilled = allFilled.concat(filledLogs);
          allCancelled = allCancelled.concat(cancelLogs);
        }

        if (!isMounted) return;

        // Process placed orders
        const ordersMap = new Map();
        allPlaced.forEach(log => {
          const args = log.args;
          if (!args) return;
          ordersMap.set(args.orderId.toString(), {
            id: args.orderId,
            maker: args.maker,
            token: args.token,
            amount: args.amount,
            isBid: args.isBid,
            tick: args.tick,
            isFlipOrder: args.isFlipOrder,
            flipTick: args.flipTick,
            amountFilled: 0n,
            status: 'Active',
            blockNumber: log.blockNumber
          });
        });

        // Add fills
        allFilled.forEach(log => {
          const args = log.args;
          if (!args) return;
          const o = ordersMap.get(args.orderId.toString());
          if (o) {
            o.amountFilled += args.amountFilled;
            if (o.amountFilled >= o.amount) {
              o.status = 'Filled';
            } else {
              o.status = 'Partially Filled';
            }
          }
        });

        // Process cancellations
        // We have to filter cancelLogs by order IDs we actually own
        allCancelled.forEach(log => {
          const args = log.args;
          if (!args) return;
          const o = ordersMap.get(args.orderId.toString());
          if (o && o.status !== 'Filled') {
            o.status = 'Cancelled';
          }
        });

        const sortedOrders = Array.from(ordersMap.values()).sort((a, b) => Number(b.id - a.id));
        setOrders(sortedOrders);

      } catch (err) {
        console.error("Error fetching order history:", err);
        setError('Failed to fetch blockchain history. Try switching RPC or refreshing.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    fetchHistory();
    // Refresh history every 10 seconds
    const interval = setInterval(fetchHistory, 10000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isConnected, address, publicClient, currentNetworkId]);

  const exportData = (type) => {
    let headers;
    let rows;
    let filename;
    let title;

    if (historyTab === 'orders') {
      headers = ["Order ID", "Side", "Token", "Amount", "Filled", "Price (pUSD)", "Status"];
      rows = orders.map(o => {
        const token = TOKEN_LIST.find(t => t.address.toLowerCase() === o.token.toLowerCase()) || { symbol: '???', decimals: 6 };
        return [
          o.id.toString(), o.isBid ? 'Buy' : 'Sell', token.symbol,
          formatUnits(o.amount, token.decimals), formatUnits(o.amountFilled, token.decimals),
          tickToPrice(o.tick).toFixed(4), o.status
        ];
      });
      filename = "tempo_orders";
      title = "Tempo DEX - Limit Orders History";
    } else {
      headers = ["Date", "Paid", "Received", "Transaction Hash"];
      rows = swaps.map(s => [
        new Date(s.time).toLocaleString(), `${s.amountIn} ${s.tokenIn}`,
        `${s.amountOut} ${s.tokenOut}`, s.txHash
      ]);
      filename = "tempo_swaps";
      title = "Tempo DEX - Swap History";
    }

    if (type === 'csv') {
      const csvStr = [headers, ...rows].map(row => row.map(v => `"${v}"`).join(",")).join("\n");
      const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${filename}.csv`;
      link.click();
    } else if (type === 'xlsx') {
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "History");
      XLSX.writeFile(wb, `${filename}.xlsx`);
    } else if (type === 'pdf') {
      const doc = new jsPDF();
      doc.text(title, 14, 15);
      doc.autoTable({ head: [headers], body: rows, startY: 20 });
      doc.save(`${filename}.pdf`);
    }
  };

  if (!isConnected) {
    return (
      <div className="swap-container" style={{ animation: 'fadeInUp 0.4s ease-out' }}>
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📜</div>
          <h3 style={{ marginBottom: '8px' }}>Order History</h3>
          <p style={{ color: 'var(--text-dim)', fontSize: '14px', lineHeight: 1.6, marginBottom: '24px' }}>
            Connect your wallet to view your active and past limit orders.
          </p>
          <button className="btn-connect" onClick={onConnect}>
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="swap-container" style={{ animation: 'fadeInUp 0.4s ease-out', maxWidth: '600px' }}>
      <div style={{ padding: '16px', borderBottom: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontSize: '20px', marginBottom: '4px' }}>📜 History</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-dim)' }}>Your recent limit orders and local swap history.</p>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={() => exportData('csv')} style={{ padding: '6px 10px', background: 'var(--bg-panel)', color: 'var(--text-main)', border: '1px solid var(--border-light)', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: '0.2s', display: 'flex', alignItems: 'center', gap: '4px' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card)'} onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-panel)'}>
              📄 CSV
            </button>
            <button onClick={() => exportData('xlsx')} style={{ padding: '6px 10px', background: 'var(--bg-panel)', color: 'var(--success)', border: '1px solid var(--border-light)', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: '0.2s', display: 'flex', alignItems: 'center', gap: '4px' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card)'} onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-panel)'}>
              📊 Excel
            </button>
            <button onClick={() => exportData('pdf')} style={{ padding: '6px 10px', background: 'var(--bg-panel)', color: 'var(--danger)', border: '1px solid var(--border-light)', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: '0.2s', display: 'flex', alignItems: 'center', gap: '4px' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card)'} onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-panel)'}>
              📑 PDF
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', background: 'var(--bg-card)', borderRadius: '12px', padding: '4px', border: '1px solid var(--border-light)' }}>
          <button onClick={() => setHistoryTab('orders')} style={{ flex: 1, padding: '8px', border: 'none', background: historyTab === 'orders' ? 'var(--brand-primary)' : 'transparent', color: historyTab === 'orders' ? 'white' : 'var(--text-dim)', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer', transition: '0.2s' }}>Limit Orders</button>
          <button onClick={() => setHistoryTab('swaps')} style={{ flex: 1, padding: '8px', border: 'none', background: historyTab === 'swaps' ? 'var(--brand-primary)' : 'transparent', color: historyTab === 'swaps' ? 'white' : 'var(--text-dim)', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer', transition: '0.2s' }}>Swaps</button>
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        {historyTab === 'orders' && (
          <>
            {isLoading && orders.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-dim)', fontSize: '14px' }}>
                ⏳ Searching blockchain logs...
              </div>
            )}
            {error && (
              <div style={{ padding: '12px', background: 'rgba(255, 71, 87, 0.1)', color: 'var(--danger)', border: '1px solid var(--danger)', borderRadius: '8px', fontSize: '13px', textAlign: 'center', marginBottom: '12px' }}>
                {error}
              </div>
            )}
            {!isLoading && orders.length === 0 && !error && (
              <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-dim)', fontSize: '14px' }}>
                No limit orders found for this wallet on-chain.
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {orders.map(order => (
                <OrderRow key={order.id.toString()} order={order} currentNetworkId={currentNetworkId} />
              ))}
            </div>
          </>
        )}

        {historyTab === 'swaps' && (
          <>
            <div style={{ padding: '10px 12px', marginBottom: '16px', background: 'rgba(255, 171, 0, 0.1)', color: 'var(--warning)', border: '1px solid rgba(255, 171, 0, 0.2)', borderRadius: '8px', fontSize: '12px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <span style={{ fontSize: '14px' }}>⚠️</span>
              <span style={{ lineHeight: 1.4 }}><strong>Note:</strong> Swap history is saved locally in this browser. Clearing your browser data will permanently delete these records. Download them to keep a copy!</span>
            </div>
            {swaps.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-dim)', fontSize: '14px' }}>
                No recent swaps found in this browser.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {swaps.map(swap => (
                  <SwapRow key={swap.txHash} swap={swap} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
