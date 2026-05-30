-- Create sensor_data table
CREATE TABLE public.sensor_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    temperature REAL,
    humidity REAL,
    moisture REAL,
    air_quality REAL,
    light_intensity REAL,
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create device_control table
CREATE TABLE public.device_control (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mist_maker BOOLEAN DEFAULT false,
    cooling_fan BOOLEAN DEFAULT false,
    light_intensity INTEGER DEFAULT 0,
    mode TEXT CHECK (mode IN ('AUTO', 'MANUAL')) DEFAULT 'MANUAL',
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Enable Row Level Security (RLS) - recommended for Supabase
ALTER TABLE public.sensor_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_control ENABLE ROW LEVEL SECURITY;

-- Create policies (modify these based on your actual auth requirements)
-- Example: Allow anon read access (remove if data should be private)
CREATE POLICY "Enable read access for all users" ON public.sensor_data
    FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON public.device_control
    FOR SELECT USING (true);

-- Example: Allow both authenticated and anonymous users to insert data (e.g. your IoT devices)
CREATE POLICY "Enable insert access for all users" ON public.sensor_data
    FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Enable insert access for all users" ON public.device_control
    FOR INSERT TO anon, authenticated WITH CHECK (true);
    
-- Note: You may want to create an index on the timestamp columns for faster timeseries queries
CREATE INDEX idx_sensor_data_timestamp ON public.sensor_data (timestamp DESC);
CREATE INDEX idx_device_control_timestamp ON public.device_control (timestamp DESC);
