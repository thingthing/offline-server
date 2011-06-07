<?php

class OfflineClientBuilder {
	const targets_path = 'share/offline/targets';
	const xulruntimes_path = 'share/offline/xulruntimes';
	const xulapp_path = 'share/offline/xulapp';

	private $output_dir = '.';

	private $targets_path = '';
	private $xulruntimes_path = '';
	private $xulapp_path = '';

	public $error = '';

	public function __construct($output_dir = '.') {
		$this->output_dir = $output_dir;
		$this->_initPath();
		return $this;
	}

	private function _initPath() {
		include_once('WHAT/Lib.Prefix.php');

		global $pubdir;

		$this->targets_path = sprintf('%s/%s', $pubdir, self::targets_path);
		$this->xulruntimes_path = sprintf('%s/%s', $pubdir, self::xulruntimes_path);
		$this->xulapp_path = sprintf('%s/%s', $pubdir, self::xulapp_path);

		return true;
	}

	public function build($os, $arch, $prefix, $outputFile) {
		include_once('WHAT/Lib.Common.php');

		global $pubdir;

		if( strpos($os, '/') !== false ) {
			$this->error = sprintf("Malformed OS '%s' (cannot contains '/').", $os);
			return false;
		}
		if( strpos($arch, '/') !== false ) {
			$this->error = sprintf("Marlformed architecture '%s' (cannot contains '/').", $arch);
			return false;
		}

		$target_dir = sprintf("%s/%s/%s", $this->targets_path, $os, $arch);
		if( ! is_dir($target_dir) ) {
			$this->error = sprintf("Target directory '%s' is not a valid directory.", $target_dir);
			return false;
		}
		$build_script = sprintf('%s/build.sh', $target_dir);
		if( ! is_file($build_script) ) {
			$this->error = sprintf("Build script '%s' is not a valid file.", $build_script);
			return false;
		}
		if( ! is_executable($build_script) ) {
			$this->error = sprintf("Build script '%s' is not executable.", $build_script);
			return false;
		}

		if( ! is_dir($this->output_dir) ) {
			$this->error = sprintf("Output dir '%s' does not exists.", $this->output_dir);
			return false;
		}
		if( ! is_writable($this->output_dir) ) {
			$this->error = sprintf("Output dir '%s' is not writable.", $this->output_dir);
			return false;
		}

		$tmpfile = tempnam(getTmpDir(), __CLASS__);
		if( $tmpfile === false ) {
			$this->error = sprintf("Could not create temporary file.");
			return false;
		}

		$prefix = $this->expandFilename($prefix, array('OS' => $os, 'ARCH' => $arch));
		$outputFile = sprintf('%s/%s', $this->output_dir, $this->expandFilename($outputFile, array('OS' => $os, 'ARCH' => $arch)));

		$cwd = getcwd();

		$ret = chdir($target_dir);
		if( $ret === false ) {
			$this->error = sprintf("Could not chdir to '%s'.", $target_dir);
			return false;
		}

		$orig_wpub = getenv('wpub');
		putenv(sprintf('wpub=%s', $pubdir));

		$cmd = sprintf('%s %s %s > %s 2>&1', escapeshellarg($build_script), escapeshellarg($prefix), escapeshellarg($outputFile), escapeshellarg($tmpfile));
		$out = system($cmd, $ret);
		if( $ret !== 0 ) {
			$this->error = sprintf("Error building client for {os='%s', arch='%s', prefix='%s', outputFile='%s'}: %s", $os, $arch, $prefix, $outputFile, file_get_contents($tmpfile));
		}

		if( $orig_wpub === false ) {
			putenv('wpub');
		} else {
			putenv(sprintf('wpub=%s', $orig_wpub));
		}

		unlink($tmpfile);
		chdir($cwd);
		return ($ret === 0) ? true : false;
	}

	public function buildAll() {
		foreach( $this->getOsArchList() as $spec ) {

			$argv = array(
				0 => $spec['os'],
				1 => $spec['arch'],
				2 => $spec['prefix'],
				3 => $spec['file']
			);

			$ret = call_user_func_array(array($ocb, 'build'), $argv);
			if( $ret === false ) {
				$this->error = sprintf("Build error for {'os'=%s, 'arch'=%s}: %s", $os, $arch, $this->error);
				return false;
			}
		}
		return true;
	}

	public function getOsArchList() {
		include_once('WHAT/Lib.Prefix.php');

		global $pubdir;

		$osArchList = array(
			array(
				'title' => 'Linux (i686)',
				'os' => 'linux',
				'arch' => 'i686',
				'icon' => sprintf("%s/share/offline/linux/icon-linux.png", $pubdir),
				'prefix' => 'dynacase-offline-%VERSION%',
				'file' => 'dynacase-offline-linux-i686.tar.gz'
			),
			array(
				'title' => 'Linux (x86_64)',
				'os' => 'linux',
				'arch' => 'x86_64',
				'icon' => sprintf("%s/share/offline/linux/icon-linux.png", $pubdir),
				'prefix' => 'dynacase-offline-%VERSION%',
				'file' => 'dynacase-offline-linux-x86_64.tar.gz'
			),
			array(
				'title' => 'Mac OS X (universal)',
				'os' => 'mac',
				'arch' => 'universal',
				'icon' => sprintf("%s/share/offline/mac/icon-mac.png", $pubdir),
				'prefix' => 'dynacase-offline-%VERSION%',
				'file' => 'dynacase-offline-mac-universal.zip'
			),
			array(
				'title' => 'Windows XP/Vista/7 (EXE 32 bits)',
				'os' => 'win',
				'arch' => '32',
				'icon' => sprintf("%s/share/offline/win/icon-win.png", $pubdir),
				'prefix' => 'dynacase-offline-%VERSION%',
				'file' => 'dynacase-offline-win-32.exe'
			),
			array(
				'title' => 'Windows XP/Vista/7 (Zip 32 bits)',
				'os' => 'win',
				'arch' => '32_zip',
				'icon' => sprintf("%s/share/offline/win/icon-win.png", $pubdir),
				'prefix' => 'dynacase-offline-%VERSION%',
				'file' => 'dynacase-offline-win-32.zip'
			)
		);

		$local_osArchList = sprintf('%s/OFFLINE/local_osArchList.php', $pubdir);
		if( file_exists($local_osArchList) ) {
			include_once($local_osArchList);
		}

		return $osArchList; 
	}

	public function expandFilename($filename, $keymap = array()) {
		$keymap['VERSION'] = $this->_getOfflineVersion();

		foreach( $keymap as $k => $v ) {
			$filename = str_replace(sprintf('%%%s%%', $k), $v, $filename);
		}

		return $filename;
	}

	public static function test() {
		$outputDir = '/tmp';
		$ocb = new OfflineClientBuilder($outputDir);

		foreach( $ocb->getOsArchList() as $spec ) {

			$argv = array(
				0 => $spec['os'],
				1 => $spec['arch'],
				2 => $spec['prefix'],
				3 => $spec['file']
			);

			print sprintf("Building %s/%s... ", $argv[0], $argv[1]);
			$ret = call_user_func_array(array($ocb, 'build'), $argv);
			if( $ret === false ) {
				print "[ERROR]\n";
				print sprintf("%s\n", $ocb->error);
				print "\n";
			} else {
				print "[OK]\n";
			}
		}
	}

	private function _getOfflineVersion() {
		include_once('WHAT/Class.Application.php');
		$null = null;

		$app = new Application();
		$ret = $app->set('OFFLINE', $null);
		if( $ret != '' ) {
			return false;
		}

		$p = new Param($null, array('VERSION', PARAM_APP, $app->id));
		if( is_object($p) && property_exists($p, 'val') ) {
			return $p->val;
		}
		return false;
	}
}

?>