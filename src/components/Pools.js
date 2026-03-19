'use client';
import { useState } from 'react';
import { useAccount, useConnect, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import { TOKENS, PAIR_ADDRESS, DEX_PAIR_ABI } from '@/config/web3';

export default function Pools() {
  const { address, isConnected } = useAccount();
  const { connectors, connect } = useConnect();
  
  const [token0, setToken0] = useState(TOKENS.ALPHA_USD);
  const [token1, setToken1] = useState(TOKENS.TEMPO_ETH);
  const [amount0, setAmount0] = useState('');
  const [amount1, setAmount1] = useState('');
  
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  // Auto-calculate required ratio based on current reserves
  // Hardcoded 2000 AUSD = 1 tETH ratio
  const handleAmount0Change = (val) => {
    setAmount0(val);
    if(val && !isNaN(val)) {
      setAmount1((parseFloat(val) / 2000).toFixed(6));
    } else {
      setAmount1('');
    }
  };

  const handleAmount1Change = (val) => {
    setAmount1(val);
    if(val && !isNaN(val)) {
      setAmount0((parseFloat(val) * 2000).toFixed(2));
    } else {
      setAmount0('');
    }
  };

  const handleAddLiquidity = () => {
    if (!isConnected) {
      connect({ connector: connectors[0] });
      return;
    }
    
    if (!amount0 || !amount1) return;

    // In a real DEX, you approve tokens first.
    writeContract({
      address: PAIR_ADDRESS,
      abi: DEX_PAIR_ABI,
      functionName: 'addLiquidity',
      args: [
        parseUnits(amount0, 6),
        parseUnits(amount1, 18),
        address
      ],
    });
  };

  return (
    <div className="swap-container" style={{ animation: 'fadeInUp 0.4s ease-out', maxWidth: '600px' }}>
      <div className="swap-header" style={{ display: 'block', textBase: 'center', paddingBottom: '20px' }}>
        <h2 style={{ fontSize: '24px', marginBottom: '8px' }}>Liquidity Pools</h2>
        <p style={{ color: 'var(--text-dim)', fontSize: '14px', lineHeight: '1.5' }}>
          Provide liquidity to earn 0.3% of all trades on this pair proportional to your share of the pool.
          <strong> Gas fees on Tempo are 100% sponsored.</strong>
        </p>
      </div>

      <div style={{ padding: '8px' }}>
        <div style={{ padding: '16px', background: 'var(--bg-card)', borderRadius: 'var(--radius-inner)', marginBottom: '16px', border: '1px solid var(--border-light)' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '16px' }}>Add Liquidity</h3>
          
          {/* Token 0 */}
          <div className="input-row" style={{ marginBottom: '16px', background: 'var(--bg-panel)', padding: '12px', borderRadius: '8px' }}>
            <input 
              type="number" 
              className="token-input" 
              placeholder="0.0" 
              value={amount0}
              onChange={(e) => handleAmount0Change(e.target.value)}
              style={{ fontSize: '24px' }}
            />
            <div className="token-selector" style={{ background: 'var(--bg-card)' }}>
              <span className="token-logo">{token0.logo}</span>
              <span style={{ marginLeft: '4px' }}>{token0.symbol}</span>
            </div>
          </div>

          <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '8px 0', fontSize: '20px' }}>+</div>

          {/* Token 1 */}
          <div className="input-row" style={{ marginBottom: '24px', background: 'var(--bg-panel)', padding: '12px', borderRadius: '8px' }}>
            <input 
              type="number" 
              className="token-input" 
              placeholder="0.0" 
              value={amount1}
              onChange={(e) => handleAmount1Change(e.target.value)}
              style={{ fontSize: '24px' }}
            />
            <div className="token-selector" style={{ background: 'var(--bg-card)' }}>
              <span className="token-logo" style={{ background: 'var(--brand-primary-dim)', color: 'var(--brand-primary)' }}>{token1.logo}</span>
              <span style={{ marginLeft: '4px' }}>{token1.symbol}</span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'var(--brand-primary-dim)', borderRadius: '8px', color: 'var(--brand-primary)', fontSize: '14px', marginBottom: '24px' }}>
            <span>Current Price:</span>
            <strong>1 {token1.symbol} = 2,000 {token0.symbol}</strong>
          </div>

          <button 
            className="btn-primary" 
            onClick={handleAddLiquidity}
            disabled={isPending || (isConnected && (!amount0 || parseFloat(amount0) <= 0))}
          >
            {!isConnected ? 'Connect Wallet' : 
              isPending ? 'Confirming deposit...' :
              !amount0 ? 'Enter amounts' : 
              'Supply Liquidity'}
          </button>
        </div>

        {txHash && (
          <div style={{ marginTop: '16px', padding: '12px', borderRadius: '12px', background: isSuccess ? 'rgba(39, 174, 96, 0.1)' : 'var(--bg-card)', border: `1px solid ${isSuccess ? 'var(--success)' : 'var(--border-light)'}`, fontSize: '14px', textAlign: 'center' }}>
            {isConfirming && <div>Depositing into Tempo Liquidity Pool...</div>}
            {isSuccess && 
              <div style={{ color: 'var(--success)' }}>
                Liquidity Added Successfully! <br/>
                <a href={`https://explore.tempo.xyz/tx/${txHash}`} target="_blank" style={{ color: 'var(--brand-primary)', textDecoration: 'none', fontWeight: 'bold' }}>View on Explorer ↗</a>
              </div>
            }
          </div>
        )}

        {/* Existing Positions */}
        {isConnected && (
          <div style={{ padding: '16px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-inner)', marginTop: '24px' }}>
            <h3 style={{ fontSize: '16px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between' }}>
              Your Positions
              <span style={{ fontSize: '13px', background: 'var(--bg-card)', padding: '2px 8px', borderRadius: '12px', color: 'var(--brand-primary)' }}>1 Active</span>
            </h3>
            
            <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '18px' }}>{token0.logo}{token1.logo}</span>
                  <strong>{token0.symbol} / {token1.symbol}</strong>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-dim)' }}>
                  Share: 0.05% · Earned: $12.40
                </div>
              </div>
              <button style={{ background: 'none', border: '1px solid var(--border-light)', color: 'var(--text-main)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>
                Manage
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
