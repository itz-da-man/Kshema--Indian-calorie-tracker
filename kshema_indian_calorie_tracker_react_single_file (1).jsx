import React, { useState, useEffect, useRef } from "react";

// KSHEMA - Single-file React component prototype
// - Tailwind CSS assumed present in project
// - This is a frontend-first prototype. Image recognition is MOCKED locally with a lookup table.
// - To make real detection: integrate a vision model (TensorFlow.js / server-side API) and replace `mockProcessImage`.

const FOOD_DB = {
  rice: { kcal: 200, label: "Rice (1 cup)" },
  roti: { kcal: 120, label: "Roti (1)" },
  dal: { kcal: 95, label: "Dal (1 bowl)" },
  curd: { kcal: 60, label: "Curd (100g)" },
  pickle: { kcal: 15, label: "Pickle (1 tbsp)" },
  sabzi: { kcal: 80, label: "Vegetable sabzi (1 serving)" },
  samosa: { kcal: 250, label: "Samosa (1)" },
  kachori: { kcal: 220, label: "Kachori (1)" },
  fries: { kcal: 300, label: "Fries (1 serving)" },
  pakora: { kcal: 180, label: "Pakora (4 pieces)" },
  idli: { kcal: 39, label: "Idli (1)" },
  dosa: { kcal: 150, label: "Dosa (1)" },
  sambar: { kcal: 70, label: "Sambar (1 bowl)" },
  paratha: { kcal: 250, label: "Paratha (1)" },
  salad: { kcal: 25, label: "Salad (1 serving)" },
  sweet: { kcal: 350, label: "Sweet (1 serving)" },
};

const MAX_PERSONS = 5;
const STORAGE_KEY = "kshema_data_v1";

function daysArray(n = 30) {
  const arr = [];
  for (let i = 0; i < n; i++) arr.push({ date: offsetDate(i), meals: {} });
  return arr;
}

function offsetDate(offsetFromToday) {
  const d = new Date();
  d.setDate(d.getDate() - (offsetFromToday));
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function fmtDate(dateStr) {
  return new Date(dateStr).toLocaleDateString();
}

export default function KSHEMAApp() {
  const [persons, setPersons] = useState([]);
  const [selectedPersonIdx, setSelectedPersonIdx] = useState(0);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [imageFile, setImageFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [lastDetected, setLastDetected] = useState([]);
  const fileInputRef = useRef();

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setPersons(parsed.persons || []);
        setSelectedPersonIdx(parsed.selectedPersonIdx || 0);
      } catch (e) {
        console.error("Corrupt storage, resetting.");
      }
    }
  }, []);

  useEffect(() => {
    saveToStorage();
  }, [persons, selectedPersonIdx]);

  function saveToStorage() {
    const payload = { persons, selectedPersonIdx };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }

  function addPerson() {
    if (persons.length >= MAX_PERSONS) return alert("Maximum persons reached (5)");
    const name = prompt("Enter person's name:");
    if (!name) return;
    const gender = prompt("Gender (M/F/Other):") || "Other";
    const age = prompt("Age:") || "-";
    const newPerson = {
      id: Date.now(),
      name,
      gender,
      age,
      days: daysArray(30),
    };
    setPersons(prev => [...prev, newPerson]);
    setSelectedPersonIdx(persons.length);
  }

  function removePerson(idx) {
    if (!confirm(`Remove ${persons[idx].name}?`)) return;
    const newP = [...persons];
    newP.splice(idx, 1);
    setPersons(newP);
    setSelectedPersonIdx(Math.max(0, idx - 1));
  }

  function handleFileChange(e) {
    const f = e.target.files[0];
    setImageFile(f || null);
  }

  // MOCK image processing function.
  // In a real app you'd call a vision model or server endpoint that returns detected items and bounding boxes.
  async function mockProcessImage(file) {
    // heuristic: if filename includes keywords, return those; else randomly pick items common in Indian meals
    await new Promise(r => setTimeout(r, 900)); // fake latency
    const filename = file ? file.name.toLowerCase() : "";
    const picks = [];
    Object.keys(FOOD_DB).forEach(k => {
      if (filename.includes(k)) picks.push({ name: k, kcal: FOOD_DB[k].kcal });
    });
    if (picks.length === 0) {
      // random picks to simulate detection for demo
      const keys = Object.keys(FOOD_DB);
      const n = Math.max(1, Math.min(4, Math.floor(Math.random() * 4) + 1));
      while (picks.length < n) {
        const k = keys[Math.floor(Math.random() * keys.length)];
        if (!picks.find(p => p.name === k)) picks.push({ name: k, kcal: FOOD_DB[k].kcal });
      }
    }
    // break down common combos: e.g., if rice present, maybe dal & sabzi
    if (picks.find(p => p.name === "rice") && !picks.find(p => p.name === "dal")) picks.push({ name: "dal", kcal: FOOD_DB["dal"].kcal });
    return picks;
  }

  async function processAndTrack() {
    if (!imageFile) return alert("Please choose an image first (Take the pic)");
    if (!persons[selectedPersonIdx]) return alert("Add a person first.");
    setProcessing(true);
    try {
      const detected = await mockProcessImage(imageFile);
      setLastDetected(detected);
      // convert to meal items
      const items = detected.map(d => ({ name: d.name, kcal: d.kcal, qty: 1 }));
      // store into selected person's selected date under an 'auto' meal (user can adjust)
      setPersons(prev => {
        const copy = JSON.parse(JSON.stringify(prev));
        const person = copy[selectedPersonIdx];
        const dayIdx = person.days.findIndex(d => d.date === selectedDate);
        if (dayIdx === -1) {
          // out-of-range date -> add
          person.days.unshift({ date: selectedDate, meals: {} });
        }
        const meals = person.days.find(d => d.date === selectedDate).meals;
        meals.auto = meals.auto || [];
        meals.auto.push({ time: new Date().toISOString(), items });
        return copy;
      });
      alert("Image processed — items added to track. You can edit quantities or move to breakfast/lunch/dinner.");
    } finally {
      setProcessing(false);
    }
  }

  function addDetectedToMeal(mealKey) {
    if (!persons[selectedPersonIdx]) return;
    setPersons(prev => {
      const copy = JSON.parse(JSON.stringify(prev));
      const person = copy[selectedPersonIdx];
      const day = person.days.find(d => d.date === selectedDate);
      if (!day) return prev;
      day.meals[mealKey] = day.meals[mealKey] || [];
      lastDetected.forEach(d => day.meals[mealKey].push({ name: d.name, kcal: d.kcal, qty: 1 }));
      return copy;
    });
    alert(`Added detected items to ${mealKey}`);
  }

  function manualAddItem(mealKey) {
    const food = prompt("Enter food name (e.g., roti, rice, samosa):");
    if (!food) return;
    const key = food.toLowerCase();
    const kcal = FOOD_DB[key] ? FOOD_DB[key].kcal : parseInt(prompt("Calories for this item (approx):"), 10) || 50;
    setPersons(prev => {
      const copy = JSON.parse(JSON.stringify(prev));
      const person = copy[selectedPersonIdx];
      const day = person.days.find(d => d.date === selectedDate);
      day.meals[mealKey] = day.meals[mealKey] || [];
      day.meals[mealKey].push({ name: key, kcal, qty: 1 });
      return copy;
    });
  }

  function mealTotal(items = []) {
    return items.reduce((s, it) => s + (it.kcal || 0) * (it.qty || 1), 0);
  }

  function totalForDate(person, date) {
    const day = person.days.find(d => d.date === date);
    if (!day) return 0;
    const mealKeys = Object.keys(day.meals || {});
    return mealKeys.reduce((s, mk) => s + mealTotal(day.meals[mk]), 0);
  }

  function renderPersonPanel(person, idx) {
    return (
      <div key={person.id} className="p-3 border rounded-lg">
        <div className="flex justify-between items-start">
          <div>
            <div className="font-semibold">{person.name}</div>
            <div className="text-sm text-slate-500">{person.gender} · Age {person.age}</div>
          </div>
          <div className="text-right">
            <div className="text-sm">30-day stored</div>
            <div className="text-lg font-bold">{person.days.length} days</div>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button className="px-3 py-1 rounded bg-slate-700 text-white text-sm" onClick={() => setSelectedPersonIdx(idx)}>Select</button>
          <button className="px-3 py-1 rounded border text-sm" onClick={() => removePerson(idx)}>Remove</button>
        </div>
      </div>
    );
  }

  function exportData() {
    const blob = new Blob([JSON.stringify({ persons }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "kshema_export.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function clearStorage() {
    if (!confirm("Clear all stored data?")) return;
    localStorage.removeItem(STORAGE_KEY);
    setPersons([]);
  }

  function reviewCycle() {
    // analyze last 15 days for selected person
    const person = persons[selectedPersonIdx];
    if (!person) return alert("Select a person first");
    const recent = person.days.slice(0, 15);
    let highNut = 0, lowNut = 0;
    recent.forEach(d => {
      // naive nutrient check: count green items (salad/curd/dal/sambar) vs fried/sweets
      const items = Object.values(d.meals || {}).flat();
      const score = items.reduce((s, it) => {
        const name = it.name || "";
        if (["salad", "curd", "dal", "sambar", "idli"].includes(name)) return s + 1;
        if (["samosa", "fries", "sweet", "pakora"].includes(name)) return s - 1;
        return s;
      }, 0);
      if (score >= 1) highNut++; else lowNut++;
    });
    const msg = (highNut >= lowNut) ?
      `Good job! Over the last 15 days you had nutrient-rich patterns ${highNut}/${recent.length} times.` :
      `Try improving variety — nutrient-rich patterns low (${highNut}/${recent.length}). Consider more dal/curd/salad/idli/sambar.`;
    alert(msg);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Animated KSHEMA header */}
        <header className="mb-6">
          <h1 className="text-5xl font-extrabold tracking-tight leading-none animate-kfont bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(90deg,#FF5F6D,#FFC371,#7F00FF)' }}>
            KSHEMA
          </h1>
          <p className="text-slate-600 mt-2">Indian-style meal photo calorie tracker — prototype</p>
        </header>

        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-1">
            <div className="bg-white p-4 rounded-lg shadow-md">
              <h2 className="font-semibold mb-2">People (max 5)</h2>
              <div className="space-y-2">{persons.map((p, i) => renderPersonPanel(p, i))}</div>
              <div className="mt-3 flex gap-2">
                <button className="px-3 py-2 rounded bg-indigo-600 text-white" onClick={addPerson}>Add Person</button>
                <button className="px-3 py-2 rounded border" onClick={exportData}>Export</button>
                <button className="px-3 py-2 rounded border text-red-600" onClick={clearStorage}>Clear</button>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow-md mt-4">
              <h3 className="font-semibold">Image Input (Take the pic)</h3>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="mt-2" />
              <div className="mt-2 flex gap-2">
                <button className="px-3 py-2 rounded bg-green-600 text-white" onClick={processAndTrack} disabled={processing}>{processing ? "Processing..." : "Process & Track"}</button>
                <button className="px-3 py-2 rounded border" onClick={() => { fileInputRef.current && (fileInputRef.current.value = null); setImageFile(null); setLastDetected([]); }}>Reset</button>
              </div>

              <div className="mt-3 text-sm text-slate-600">Detected items (mock):</div>
              <ul className="mt-2 list-disc pl-5 text-sm">
                {lastDetected.map((d, i) => <li key={i}>{FOOD_DB[d.name]?.label || d.name} — approx {d.kcal} kcal</li>)}
              </ul>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button className="px-2 py-1 rounded border text-sm" onClick={() => addDetectedToMeal('breakfast')}>Add to Breakfast</button>
                <button className="px-2 py-1 rounded border text-sm" onClick={() => addDetectedToMeal('lunch')}>Add to Lunch</button>
                <button className="px-2 py-1 rounded border text-sm" onClick={() => addDetectedToMeal('dinner')}>Add to Dinner</button>
                <button className="px-2 py-1 rounded border text-sm" onClick={() => addDetectedToMeal('snacks')}>Add to Snacks</button>
              </div>

            </div>

          </div>

          <div className="col-span-2">
            <div className="bg-white p-4 rounded-lg shadow-md">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-sm text-slate-500">Selected person</div>
                  <div className="font-semibold text-lg">{persons[selectedPersonIdx]?.name || '—'}</div>
                  <div className="text-sm text-slate-500">Date</div>
                  <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="mt-1 p-1 border rounded" />
                </div>
                <div className="text-right">
                  <div className="text-sm">Total calories</div>
                  <div className="text-2xl font-bold">{persons[selectedPersonIdx] ? totalForDate(persons[selectedPersonIdx], selectedDate) : 0} kcal</div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4">
                {['breakfast', 'lunch', 'dinner', 'snacks', 'auto'].map(k => (
                  <div key={k} className="p-3 border rounded">
                    <div className="flex justify-between items-center">
                      <div className="font-semibold capitalize">{k}</div>
                      <div className="text-sm">{(() => {
                        const p = persons[selectedPersonIdx];
                        if (!p) return 0;
                        const day = p.days.find(d => d.date === selectedDate);
                        if (!day || !day.meals[k]) return 0;
                        return mealTotal(day.meals[k]);
                      })()} kcal</div>
                    </div>
                    <div className="mt-2 text-sm">
                      <ul className="space-y-1">
                        {(() => {
                          const p = persons[selectedPersonIdx];
                          if (!p) return <li className="text-slate-400">No person selected</li>;
                          const day = p.days.find(d => d.date === selectedDate);
                          if (!day || !day.meals[k]) return <li className="text-slate-400">No items</li>;
                          return day.meals[k].map((it, i) => <li key={i}>{it.name} × {it.qty} — {it.kcal * (it.qty || 1)} kcal</li>);
                        })()}
                      </ul>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button className="px-2 py-1 rounded border text-sm" onClick={() => manualAddItem(k)}>Add item</button>
                      <button className="px-2 py-1 rounded border text-sm" onClick={() => {
                        // remove meal
                        if (!persons[selectedPersonIdx]) return;
                        setPersons(prev => {
                          const copy = JSON.parse(JSON.stringify(prev));
                          const p = copy[selectedPersonIdx];
                          const day = p.days.find(d => d.date === selectedDate);
                          if (day && day.meals[k]) delete day.meals[k];
                          return copy;
                        });
                      }}>Remove meal</button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex gap-2">
                <button className="px-3 py-2 rounded bg-emerald-600 text-white" onClick={() => reviewCycle()}>15-day review</button>
                <button className="px-3 py-2 rounded border" onClick={() => alert('This prototype stores 30 days locally. To persist longer, connect to backend DB.')}>Info</button>
              </div>

            </div>

            <div className="bg-white p-4 rounded-lg shadow-md mt-4">
              <h3 className="font-semibold">30-day overview (selected person)</h3>
              <div className="mt-2 grid grid-cols-6 gap-2 text-sm">
                {(() => {
                  const p = persons[selectedPersonIdx];
                  if (!p) return <div className="col-span-6 text-slate-400">No person selected</div>;
                  return p.days.map((d, i) => (
                    <div key={i} className="p-2 border rounded text-center">
                      <div className="text-xs">{d.date}</div>
                      <div className="font-bold">{totalForDate(p, d.date)} kcal</div>
                    </div>
                  ));
                })()}
              </div>
            </div>

          </div>
        </div>

        <footer className="mt-8 text-sm text-slate-500">Prototype — replace <code>mockProcessImage</code> with a vision model (TensorFlow.js / server API) for real detection. Data stored locally (30 days). Built for Indian mixed-thali style meals.</footer>
      </div>

      <style>{`
        @keyframes kfont {
          0% { filter: hue-rotate(0deg); transform: translateY(0) scale(1); }
          50% { filter: hue-rotate(40deg); transform: translateY(-4px) scale(1.03); }
          100% { filter: hue-rotate(0deg); transform: translateY(0) scale(1); }
        }
        .animate-kfont { animation: kfont 3s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
