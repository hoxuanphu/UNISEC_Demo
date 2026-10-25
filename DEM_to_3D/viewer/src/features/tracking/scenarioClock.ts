const memoryEpochs=new Map<string,number>();
export function sharedScenarioEpoch(key:string):number {
  try {const stored=Number(localStorage.getItem(key));if(stored>0&&Number.isFinite(stored))return stored;} catch { /* Memory fallback. */ }
  const epoch=memoryEpochs.get(key)??Date.now();memoryEpochs.set(key,epoch);
  try {localStorage.setItem(key,String(epoch));} catch { /* Tracking still runs in this window. */ }
  return epoch;
}
