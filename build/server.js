"use strict";var w=Object.create;var _=Object.defineProperty;var D=Object.getOwnPropertyDescriptor;var A=Object.getOwnPropertyNames;var v=Object.getPrototypeOf,N=Object.prototype.hasOwnProperty;var O=(a,t)=>{for(var e in t)_(a,e,{get:t[e],enumerable:!0})},m=(a,t,e,s)=>{if(t&&typeof t=="object"||typeof t=="function")for(let r of A(t))!N.call(a,r)&&r!==e&&_(a,r,{get:()=>t[r],enumerable:!(s=D(t,r))||s.enumerable});return a};var T=(a,t,e)=>(e=a!=null?w(v(a)):{},m(t||!a||!a.__esModule?_(e,"default",{value:a,enumerable:!0}):e,a)),b=a=>m(_({},"__esModule",{value:!0}),a);var C={};O(C,{app:()=>l,server:()=>f});module.exports=b(C);var g=T(require("express")),R=T(require("cors")),S=require("http"),p=T(require("sqlite3")),u=require("./garminService");const l=(0,g.default)(),f=(0,S.createServer)(l);l.use((0,R.default)()),l.use(g.default.json());const I=17890,H="@garmin_sync_url";let i=null;async function L(){i=new p.default.Database("garmin.sqlite"),await i.exec(`
    CREATE TABLE IF NOT EXISTS sync_status (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      garmin_configured INTEGER DEFAULT 0,
      garmin_authenticated INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS daily_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date DATE NOT NULL UNIQUE,
      steps INTEGER,
      resting_heart_rate REAL,
      body_battery INTEGER,
      sleep_seconds INTEGER,
      hrv_status TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sync_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME,
      status TEXT,
      activities_count INTEGER,
      synced_days INTEGER
    );
  `),await new Promise((t,e)=>{i?.get("SELECT COUNT(*) as count FROM sync_status",(s,r)=>{s?e(s):t(r?.count||0)})})===0&&await new Promise((t,e)=>{i?.run("INSERT INTO sync_status (garmin_configured, garmin_authenticated) VALUES (0, 0)",function(s){s?e(s):t()})})}l.get("/health",(a,t)=>{i?.get("SELECT * FROM sync_status ORDER BY id DESC LIMIT 1",(e,s)=>{if(e){t.status(500).json({ok:!1,error:e.message});return}t.json({ok:!0,garminConfigured:s?.garmin_configured||0,garminAuthenticated:s?.garmin_authenticated||0,authenticated:u.garminService.isAuthenticated()})})}),l.get("/auth/url",(a,t)=>{const e=u.garminService.getAuthorizationUrl();t.json({ok:!0,authorizationUrl:e})}),l.post("/auth/callback",async(a,t)=>{const{code:e}=a.body;if(!e)return t.status(400).json({ok:!1,error:"Authorization code required"});try{await u.garminService.exchangeCodeForTokens(e),await new Promise((s,r)=>{i?.run("UPDATE sync_status SET garmin_authenticated = 1, garmin_configured = 1 WHERE id = 1",function(o){o?r(o):s()})}),t.json({ok:!0,message:"Authenticated successfully"})}catch(s){console.error("Auth callback error:",s),t.status(500).json({ok:!1,error:s instanceof Error?s.message:"Authentication failed"})}}),l.post("/auth/logout",async(a,t)=>{try{await u.garminService.clearTokens(),await new Promise((e,s)=>{i?.run("UPDATE sync_status SET garmin_authenticated = 0, garmin_configured = 0 WHERE id = 1",function(r){r?s(r):e()})}),t.json({ok:!0,message:"Logged out successfully"})}catch(e){t.status(500).json({ok:!1,error:e instanceof Error?e.message:"Logout failed"})}}),l.get("/activities",async(a,t)=>{try{const e=parseInt(a.query.days)||30,s=await u.garminService.getActivities(e);for(const r of s){const o=new Date(r.startDateLocal).toISOString().split("T")[0];await new Promise((c,n)=>{i?.run(`INSERT INTO daily_metrics (date, steps, resting_heart_rate, body_battery, sleep_seconds, hrv_status)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(date) DO UPDATE SET
             steps = excluded.steps,
             resting_heart_rate = excluded.resting_heart_rate,
             body_battery = excluded.body_battery,
             sleep_seconds = excluded.sleep_seconds,
             hrv_status = excluded.hrv_status`,[o,r.summary.totalCalories||null,null,null,null,null],d=>{d?n(d):c()})})}t.json({ok:!0,activities:s,count:s.length})}catch(e){console.error("Error fetching activities:",e),t.status(500).json({ok:!1,error:e instanceof Error?e.message:"Failed to fetch activities"})}}),l.get("/wellness/:date",async(a,t)=>{const{date:e}=a.params;try{const s=await u.garminService.getWellnessData(e);await new Promise((r,o)=>{i?.run(`INSERT INTO daily_metrics (date, steps, resting_heart_rate, body_battery, sleep_seconds, hrv_status)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(date) DO UPDATE SET
           steps = excluded.steps,
           resting_heart_rate = excluded.resting_heart_rate,
           body_battery = excluded.body_battery,
           sleep_seconds = excluded.sleep_seconds,
           hrv_status = excluded.hrv_status`,[e,null,s.restingHeartRate||null,s.bodyBattery||null,s.sleep?.duration||null,s.hrvStatus||null],c=>{c?o(c):r()})}),t.json({ok:!0,date:e,wellness:s})}catch(s){console.error("Error fetching wellness data:",s),t.status(500).json({ok:!1,error:s instanceof Error?s.message:"Failed to fetch wellness data"})}}),l.post("/wellness/daily",async(a,t)=>{try{const{startDate:e,endDate:s}=a.body;if(!e||!s)return t.status(400).json({ok:!1,error:"startDate and endDate required"});const r=await u.garminService.getActivities(7),o=[];for(const c of r.map(n=>n.startDateLocal.split("T")[0]).reverse())try{const n=await u.garminService.getWellnessData(c);await new Promise((d,y)=>{i?.run(`INSERT INTO daily_metrics (date, steps, resting_heart_rate, body_battery, sleep_seconds, hrv_status)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(date) DO UPDATE SET
               steps = excluded.steps,
               resting_heart_rate = excluded.resting_heart_rate,
               body_battery = excluded.body_battery,
               sleep_seconds = excluded.sleep_seconds,
               hrv_status = excluded.hrv_status`,[c,null,n.restingHeartRate||null,n.bodyBattery||null,n.sleep?.duration||null,n.hrvStatus||null],E=>{E?y(E):d()})}),o.push({date:c,restingHeartRate:n.restingHeartRate,bodyBattery:n.bodyBattery,sleepDuration:n.sleep?.duration})}catch(n){console.error(`Error fetching wellness for ${c}:`,n)}t.json({ok:!0,wellness:o,count:o.length})}catch(e){console.error("Error fetching wellness data:",e),t.status(500).json({ok:!1,error:e instanceof Error?e.message:"Failed to fetch wellness data"})}}),l.get("/daily",(a,t)=>{i?.all("SELECT * FROM daily_metrics ORDER BY date DESC LIMIT 7",(e,s)=>{if(e){t.status(500).json({ok:!1,error:e.message});return}t.json({items:s||[]})})}),l.get("/sync/status",(a,t)=>{i?.all("SELECT * FROM sync_logs ORDER BY id DESC LIMIT 10",(e,s)=>{if(e){t.status(500).json({ok:!1,error:e.message});return}t.json({recent:s||[]})})}),l.get("/daily",(a,t)=>{i?.all("SELECT * FROM daily_metrics ORDER BY date DESC LIMIT 7",(e,s)=>{if(e){t.status(500).json({ok:!1,error:e.message});return}t.json({items:s||[]})})}),l.get("/sync/status",(a,t)=>{i?.all("SELECT * FROM sync_logs ORDER BY id DESC LIMIT 10",(e,s)=>{if(e){t.status(500).json({ok:!1,error:e.message});return}t.json({recent:s||[]})})}),l.post("/sync",async(a,t)=>{try{const e=await new Promise((s,r)=>{i?.run("INSERT INTO sync_logs (started_at) VALUES (?)",[new Date().toISOString()],function(o){if(o){r(o);return}s(this.lastID)})});try{if(!u.garminService.isAuthenticated())throw new Error("Not authenticated with Garmin Connect. Please authorize first.");const s=await u.garminService.getActivities(30),r=s.length,o=[];for(const c of s){const n=c.startDateLocal.split("T")[0];try{const d=await u.garminService.getWellnessData(n);o.push({date:n,wellness:d}),await new Promise((y,E)=>{i?.run(`INSERT INTO daily_metrics (date, steps, resting_heart_rate, body_battery, sleep_seconds, hrv_status)
               VALUES (?, ?, ?, ?, ?, ?)
               ON CONFLICT(date) DO UPDATE SET
                 steps = excluded.steps,
                 resting_heart_rate = excluded.resting_heart_rate,
                 body_battery = excluded.body_battery,
                 sleep_seconds = excluded.sleep_seconds,
                 hrv_status = excluded.hrv_status`,[n,null,d.restingHeartRate||null,d.bodyBattery||null,d.sleep?.duration||null,d.hrvStatus||null],h=>{h?E(h):y()})})}catch(d){console.error(`Error syncing wellness for ${n}:`,d)}}await new Promise((c,n)=>{i?.run("UPDATE sync_logs SET ended_at = ?, status = ?, activities_count = ?, synced_days = ? WHERE id = ?",[new Date().toISOString(),"success",r,o.length,e],function(d){d?n(d):c()})}),t.json({ok:!0,synced:{activities:r,days:o.length}})}catch(s){console.error("Sync error:",s),await new Promise((r,o)=>{i?.run("UPDATE sync_logs SET ended_at = ?, status = ?, activities_count = ?, synced_days = ? WHERE id = ?",[new Date().toISOString(),"error",0,0,e],function(c){c?o(c):r()})}),t.status(500).json({ok:!1,error:s instanceof Error?s.message:"Sync failed"})}}catch(e){console.error("Sync log error:",e),t.status(500).json({ok:!1,error:e instanceof Error?e.message:"Failed to start sync"})}}),f.listen(I,async()=>{await L(),console.log(`Server running on port ${I}`)});0&&(module.exports={app,server});
