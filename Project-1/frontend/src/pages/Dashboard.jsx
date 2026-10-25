import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Card, MetricCard } from '../components/ui/Card';
import { Table } from '../components/ui/Table';
import { 
  Activity, Timer, Map, Flame, Target, Trophy, 
  Watch, HeartPulse, User 
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar
} from 'recharts';

export const Dashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
  try {
    const res = await axios.get("/api/dashboard");
    const d = res.data;

    const mapUser = (u) => {
      if (!u) return null;

      return {
        UserID: u.USERID,
        FirstName: u.FIRSTNAME,
        LastName: u.LASTNAME,
        Email: u.EMAIL,
        DOB: u.DOB,
        Gender: u.GENDER,
      };
    };

    const mapAthlete = (a) => {
      if (!a) return null;

      return {
        UserID: a.USERID,
        SportType: a.SPORTTYPE,
        SkillLevel: a.SKILLLEVEL,
      };
    };

    const mapActivity = (a) => ({
      ActivityID: a.ACTIVITYID,
      Type: a.TYPE,
      Duration: Number(a.DURATION || 0),
      Distance: Number(a.DISTANCE || 0),
      Date: a.Date || a.DATE,
      UserID: a.USERID,
      _id: a.ACTIVITYID,
    });

    const mapNutrition = (n) => ({
      NutritionID: n.NUTRITIONID,
      MealType: n.MEALTYPE,
      Calories: Number(n.CALORIES || 0),
      Quantity: n.QUANTITY,
      Date: n.Date || n.DATE,
      UserID: n.USERID,
      _id: n.NUTRITIONID,
    });

    const mapGoal = (g) => ({
      GoalID: g.GOALID,
      GoalType: g.GOALTYPE,
      TargetValue: g.TARGETVALUE,
      Deadline: g.DEADLINE,
      UserID: g.USERID,
      _id: g.GOALID,
    });

    const mapWearable = (w) => ({
      DeviceID: w.DEVICEID,
      Brand: w.BRAND,
      Model: w.MODEL,
      SerialNumber: w.SERIALNUMBER,
      UserID: w.USERID,
      type: w.TYPE || "Device",
      _id: w.DEVICEID,
    });

    const mapHealthMetric = (m) => ({
      DeviceID: m.DEVICEID,
      MetricID: m.METRICID,
      MetricType: m.METRICTYPE,
      Value: Number(m.VALUE || 0),
      Unit: m.UNIT,
      Timestamp: m.TIMESTAMP,
      _id: m.METRICID,
    });

    const mapEarn = (e) => ({
      _id: `${e.ACTIVITYID}-${e.ACHIEVEMENTID}`,
      ActivityID: e.ACTIVITYID,
      AchievementID: {
        AchievementID: e.ACHIEVEMENTID,
        Title: e.TITLE,
        Description: e.DESCRIPTION,
        DateAwarded: e.DATEAWARDED,
      },
    });

    setData({
      user: mapUser(d.user),
      athlete: mapAthlete(d.athlete),

      phones: (d.phones || []).map((p) => ({
        UserID: p.USERID,
        PhoneNumber: p.PHONENUMBER,
      })),

      activities: (d.activities || []).map(mapActivity),

      nutrition: (d.nutrition || []).map(mapNutrition),

      goals: (d.goals || []).map(mapGoal),

      wearables: (d.wearables || []).map(mapWearable),

      healthMetrics: (d.healthMetrics || []).map(mapHealthMetric),

      followers: Number(d.followers || 0),
      following: Number(d.following || 0),

      notifications: d.notifications || [],

      earns: (d.earns || []).map(mapEarn),
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    setData(null);
  } finally {
    setLoading(false);
  }
};
    fetchData();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-full">Loading...</div>;
  if (!data) return <div className="flex items-center justify-center h-full">Error loading dashboard</div>;

  // Calculate summaries
  const totalActivities = data.activities.length;
  const totalDuration = data.activities.reduce((sum, act) => sum + act.Duration, 0);
  const totalDistance = data.activities.reduce((sum, act) => sum + (act.Distance || 0), 0);
  
  // Format for charts
  const activityData = [...data.activities].reverse().map(act => ({
    date: new Date(act.Date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    distance: act.Distance || 0,
    duration: act.Duration
  }));

  const hrMetrics = data.healthMetrics
    .filter(m => m.MetricType === 'Heart Rate')
    .reverse()
    .map(m => ({
      time: new Date(m.Timestamp).toLocaleDateString(undefined, { weekday: 'short' }),
      bpm: m.Value
    }));

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Hero Image */}
      <div className="w-full h-80 rounded-2xl overflow-hidden mb-8 relative shadow-2xl hover-lift group">
        <img src="/fitness.jpg" alt="Fitness Runner" className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-105" />
        <div className="gradient-overlay"></div>
        <div className="absolute inset-0 flex flex-col justify-end p-10">
          <h1 className="text-5xl font-extrabold text-white drop-shadow-lg mb-2 tracking-tight">Welcome back, {data.user.FirstName}!</h1>
          <p className="text-xl text-white/90 font-medium italic drop-shadow-md">"The only bad workout is the one that didn't happen. Keep pushing!"</p>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard 
          title="Activities" 
          value={totalActivities} 
          icon={Activity} 
          className="bg-white rounded-xl shadow-lg border border-gray-100 hover-lift"
        />
        <MetricCard 
          title="Total Duration" 
          value={totalDuration} 
          unit="min" 
          icon={Timer} 
          className="bg-white rounded-xl shadow-lg border border-gray-100 hover-lift"
        />
        <MetricCard 
          title="Total Distance" 
          value={totalDistance.toFixed(1)} 
          unit="km" 
          icon={Map} 
          className="bg-white rounded-xl shadow-lg border border-gray-100 hover-lift"
        />
        <MetricCard 
          title="Calories (Today)" 
          value={data.nutrition.length > 0 ? data.nutrition[0].Calories : 0} 
          unit="kcal" 
          icon={Flame} 
          className="bg-white rounded-xl shadow-lg border border-gray-100 hover-lift"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-xl border border-gray-100 hover-lift group">
          <div className="p-6 h-full">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center"><Activity className="mr-2 text-garmin-blue" /> Activity Distance Over Time</h3>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#666', fontWeight: 600 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#666', fontWeight: 600 }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    cursor={{ fill: 'rgba(0,124,195,0.05)' }}
                  />
                  <Bar dataKey="distance" fill="#007cc3" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* User Profile / Status */}
        <div className="bg-gradient-to-br from-garmin-dark to-gray-900 rounded-2xl shadow-xl hover-lift group text-white">
          <div className="p-6 h-full flex flex-col justify-between">
            <div>
              <h3 className="text-lg font-bold mb-6 flex items-center text-white/90"><User className="mr-2 text-garmin-blue" /> Athlete Profile</h3>
              <div className="flex items-center mb-8">
                <div className="h-16 w-16 bg-garmin-blue border-2 border-white/20 rounded-full flex items-center justify-center text-white text-xl mr-4 shadow-lg">
                  <User size={32} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">{data.user.FirstName} {data.user.LastName}</h2>
                  <p className="text-garmin-blue font-medium">{data.athlete?.SportType} • {data.athlete?.SkillLevel}</p>
                </div>
              </div>
            </div>
            <div className="space-y-4 bg-white/5 p-5 rounded-xl border border-white/10">
              <div className="flex justify-between border-b border-white/10 pb-2">
                <span className="text-white/70">Followers</span>
                <span className="font-bold text-lg">{data.followers}</span>
              </div>
              <div className="flex justify-between border-b border-white/10 pb-2">
                <span className="text-white/70">Following</span>
                <span className="font-bold text-lg">{data.following}</span>
              </div>
              <div className="flex justify-between pb-1">
                <span className="text-white/70">Goals Active</span>
                <span className="font-bold text-lg text-garmin-blue">{data.goals.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activities */}
        <Card title="Recent Activities" className="bg-white shadow-xl hover-lift border-0">
          <Table 
            columns={[
              { header: 'Type', accessor: 'Type', render: (row) => <span className="font-bold text-garmin-blue tracking-wide">{row.Type}</span> },
              { header: 'Date', accessor: 'Date', render: (row) => <span className="font-medium text-gray-600">{new Date(row.Date).toLocaleDateString()}</span> },
              { header: 'Distance', accessor: 'Distance', render: (row) => row.Distance ? <span className="font-semibold text-gray-800">{row.Distance} km</span> : <span className="text-gray-400">-</span> },
              { header: 'Duration', accessor: 'Duration', render: (row) => <span className="font-semibold text-gray-800">{row.Duration} min</span> },
            ]}
            data={data.activities.slice(0, 5)}
            keyField="_id"
          />
        </Card>

        {/* Health Metric Chart */}
        <Card title="Avg Heart Rate (Last 7 Days)" className="bg-white shadow-xl hover-lift border-0">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hrMetrics} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#666', fontWeight: 500 }} />
                <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#666', fontWeight: 500 }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Line type="monotone" dataKey="bpm" stroke="#ef4444" strokeWidth={4} dot={{ r: 5, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 8, strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Devices */}
        <div className="bg-white rounded-2xl shadow-xl hover-lift group border border-gray-100">
          <div className="p-6 h-full">
            <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center"><Watch className="mr-2 text-garmin-blue" /> My Devices</h3>
            <div className="space-y-4">
              {data.wearables.map((device, index) => (
  <div
    key={device.DeviceID ?? device._id ?? `device-${index}`}
    className="flex items-center p-4 bg-gray-50 border border-gray-100 rounded-xl transition-all hover:bg-gray-100"
  >
                  <div className="mr-4 text-garmin-blue bg-blue-50 p-3 rounded-full shadow-inner">
                    <Watch size={24} />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">{device.Brand} {device.Model}</h4>
                    <p className="text-sm text-gray-600 font-medium">SN: {device.SerialNumber}</p>
                  </div>
                  <div className="ml-auto text-xs font-bold tracking-wider uppercase bg-garmin-blue/10 text-garmin-blue px-3 py-1.5 rounded-full">
                    {device.type}
                  </div>
                </div>
              ))}
              {data.wearables.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4 bg-gray-50 rounded-xl">No devices paired.</p>
              )}
            </div>
          </div>
        </div>
        
        {/* Achievements */}
        <div className="bg-white rounded-2xl shadow-xl hover-lift group border border-gray-100">
          <div className="p-6 h-full">
            <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center"><Trophy className="mr-2 text-yellow-500" /> Recent Achievements</h3>
            <div className="space-y-4">
              {data.earns.slice(0, 3).map((earn, index) => (
  <div
    key={earn._id ?? `achievement-${index}`}
    className="flex items-center p-4 bg-yellow-50 border border-yellow-100 rounded-xl transition-all hover:bg-yellow-100/70"
  >
                  <div className="mr-4 text-yellow-500 bg-yellow-200/50 p-3 rounded-full shadow-inner">
                    <Trophy size={24} />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 text-lg">{earn.AchievementID.Title}</h4>
                    <p className="text-sm text-gray-600 font-medium mt-1">{earn.AchievementID.Description}</p>
                  </div>
                </div>
              ))}
              {data.earns.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4 bg-gray-50 rounded-xl">No achievements yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
