import { useState } from "react";
import {
  BarChart3,
  Clock,
  Music,
  TrendingUp,
  Calendar,
  Clock3,
  Disc3,
  Users,
  Tag,
  Play,
  Activity,
  BarChart,
  PieChart,
  LineChart,
  Filter,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStatistics, formatTime, formatLongTime } from "@/hooks/useStatistics";
import { useLibrary } from "@/hooks/useLibrary";
import { usePlayHistory } from "@/hooks/usePlayHistory";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart as RechartsBarChart, XAxis, YAxis, CartesianGrid, PieChart as RechartsPieChart, Pie, Cell, LineChart as RechartsLineChart, Line, Legend, Area } from "recharts";
import { cn } from "@/lib/utils";
import { getCoverUrl } from "@/lib/audio";
import { ScrollArea } from "@/components/ui/scroll-area";

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export const StatisticsView = () => {
  const { tracks } = useLibrary();
  const { history } = usePlayHistory();
  const [period, setPeriod] = useState<"day" | "week" | "month" | "year" | "all">("all");

  const stats = useStatistics({ tracks, history, period });

  const chartConfig = {
    plays: {
      label: "Lectures",
      color: "hsl(var(--chart-1))",
    },
    time: {
      label: "Temps",
      color: "hsl(var(--chart-2))",
    },
  };

  const topArtistsConfig = {
    plays: {
      label: "Lectures",
      color: "hsl(var(--primary))",
    },
  };

  const topAlbumsConfig = {
    plays: {
      label: "Lectures",
      color: "hsl(var(--secondary))",
    },
  };

  const topGenresConfig = {
    plays: {
      label: "Lectures",
      color: "hsl(var(--accent))",
    },
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Statistiques</h1>
            <p className="text-muted-foreground mt-1">
              Analyse détaillée de vos habitudes d'écoute
            </p>
          </div>
          <Select value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
            <SelectTrigger className="w-[180px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Aujourd'hui</SelectItem>
              <SelectItem value="week">Cette semaine</SelectItem>
              <SelectItem value="month">Ce mois</SelectItem>
              <SelectItem value="year">Cette année</SelectItem>
              <SelectItem value="all">Tout le temps</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Temps d'écoute</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatLongTime(stats.totalListeningTime)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatTime(stats.totalListeningTime)} au total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pistes écoutées</CardTitle>
              <Music className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.uniqueTracksPlayed}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.totalPlays} lectures au total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sessions</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalSessions}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatTime(stats.averageSessionTime)} en moyenne
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Session la plus longue</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatTime(stats.longestSession)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Temps d'écoute continu
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
            <TabsTrigger value="artists">Artistes</TabsTrigger>
            <TabsTrigger value="albums">Albums</TabsTrigger>
            <TabsTrigger value="tracks">Pistes</TabsTrigger>
            <TabsTrigger value="time">Temps</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            {/* Évolution dans le temps */}
            <Card>
              <CardHeader>
                <CardTitle>Évolution des écoutes</CardTitle>
                <CardDescription>Nombre de lectures et temps d'écoute par date</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[300px]">
                  <RechartsLineChart data={stats.listeningByDate.slice(-30)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(value) => new Date(value).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                    />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="plays"
                      stroke="hsl(var(--chart-1))"
                      strokeWidth={2}
                      name="Lectures"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="time"
                      stroke="hsl(var(--chart-2))"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      name="Temps (s)"
                    />
                  </RechartsLineChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Top 5 Artistes */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Top 5 Artistes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={topArtistsConfig} className="h-[250px]">
                    <RechartsBarChart data={stats.topArtists.slice(0, 5)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="plays" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                    </RechartsBarChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              {/* Top 5 Genres */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Tag className="w-5 h-5" />
                    Top 5 Genres
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={topGenresConfig} className="h-[250px]">
                    <RechartsPieChart>
                      <Pie
                        data={stats.topGenres.slice(0, 5)}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="plays"
                      >
                        {stats.topGenres.slice(0, 5).map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                    </RechartsPieChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Artists Tab */}
          <TabsContent value="artists" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Top 10 Artistes</CardTitle>
                <CardDescription>Vos artistes les plus écoutés</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={topArtistsConfig} className="h-[400px]">
                  <RechartsBarChart data={stats.topArtists} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={150} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="plays" fill="hsl(var(--primary))" radius={[0, 8, 8, 0]} />
                  </RechartsBarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Liste détaillée */}
            <Card>
              <CardHeader>
                <CardTitle>Détails par Artiste</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats.topArtists.map((artist, index) => (
                    <div
                      key={artist.name}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium">{artist.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatTime(artist.time)} d'écoute
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-primary">{artist.plays}</p>
                        <p className="text-xs text-muted-foreground">lectures</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Albums Tab */}
          <TabsContent value="albums" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Top 10 Albums</CardTitle>
                <CardDescription>Vos albums les plus écoutés</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={topAlbumsConfig} className="h-[400px]">
                  <RechartsBarChart data={stats.topAlbums} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={150}
                      tickFormatter={(value, index) => {
                        const album = stats.topAlbums[index];
                        return album ? `${album.name} - ${album.artist}` : value;
                      }}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="plays" fill="hsl(var(--secondary))" radius={[0, 8, 8, 0]} />
                  </RechartsBarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Liste détaillée */}
            <Card>
              <CardHeader>
                <CardTitle>Détails par Album</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats.topAlbums.map((album, index) => (
                    <div
                      key={`${album.name}-${album.artist}`}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center text-secondary font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium">{album.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {album.artist} • {formatTime(album.time)} d'écoute
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-secondary">{album.plays}</p>
                        <p className="text-xs text-muted-foreground">lectures</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tracks Tab */}
          <TabsContent value="tracks" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Top 10 Pistes</CardTitle>
                <CardDescription>Vos pistes les plus écoutées</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats.topTracks.map((item, index) => (
                    <div
                      key={item.track.id}
                      className="flex items-center gap-4 p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                        <img
                          src={getCoverUrl(item.track.coverUrl)}
                          alt={item.track.album}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-bold text-muted-foreground">
                            {index + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{item.track.title}</p>
                            <p className="text-sm text-muted-foreground truncate">
                              {item.track.artist} • {item.track.album}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-bold text-primary">{item.plays}</p>
                        <p className="text-xs text-muted-foreground">lectures</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatTime(item.time)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Time Tab */}
          <TabsContent value="time" className="space-y-4">
            {/* Par heure */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock3 className="w-5 h-5" />
                  Écoutes par Heure
                </CardTitle>
                <CardDescription>Vos heures d'écoute préférées</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[300px]">
                  <RechartsBarChart data={stats.listeningByHour}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" tickFormatter={(value) => `${value}h`} />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="plays" fill="hsl(var(--chart-1))" radius={[8, 8, 0, 0]} />
                  </RechartsBarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Par jour de la semaine */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Écoutes par Jour
                </CardTitle>
                <CardDescription>Vos jours d'écoute préférés</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[300px]">
                  <RechartsBarChart data={stats.listeningByDayOfWeek}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="plays" fill="hsl(var(--chart-2))" radius={[8, 8, 0, 0]} />
                  </RechartsBarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Par mois */}
            {stats.listeningByMonth.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart className="w-5 h-5" />
                    Écoutes par Mois
                  </CardTitle>
                  <CardDescription>Évolution mensuelle</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[300px]">
                    <RechartsBarChart data={stats.listeningByMonth}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="month"
                        angle={-45}
                        textAnchor="end"
                        height={100}
                      />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="plays" fill="hsl(var(--chart-3))" radius={[8, 8, 0, 0]} />
                    </RechartsBarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            )}

            {/* Par décennie */}
            {stats.listeningByDecade.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Disc3 className="w-5 h-5" />
                    Écoutes par Décennie
                  </CardTitle>
                  <CardDescription>Vos décennies musicales préférées</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[300px]">
                    <RechartsPieChart>
                      <Pie
                        data={stats.listeningByDecade}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ decade, percent }) => `${decade} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="plays"
                      >
                        {stats.listeningByDecade.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                    </RechartsPieChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </ScrollArea>
  );
};

